export { APU }

class ChanPulse {
    on: int
    wave: int[]

    NR0: int
    NR1: int
    NR2: int
    NR3: int
    NR4: int

    div: int
    divSweep: int
    divEnv: int
    phase: int
    length: int
    vol: int
    PCM: int

    reset() {
        this.on = 0
        this.NR0 = 0
        this.NR1 = 0
        this.NR2 = 0
        this.NR3 = 0
        this.NR4 = 0
        this.div = 0
        this.divSweep = 0
        this.divEnv = 0
        this.phase = 0
        this.length = 0
        this.vol = 0
        this.PCM = 0
    }

    constructor() {
        this.wave = <int[]>[0xFE, 0x7E, 0x78, 0x81]
        this.reset()
    }

    zombieVolume(data: int) {
        // if (!(this.NR2 & 7) && this.vol) {
        //     this.vol = this.vol + 1
        // }
        // else if (!(this.NR2 & 8)) {
        //     this.vol = this.vol + 2
        // }

        // if ((this.NR2 ^ data) & 8) {
        //     this.vol = 16 - this.vol
        // }
        // this.vol = this.vol & 0x0F
        this.vol = data >> 4
    }

    volume(data: int) {
        // this.zombieVolume(data)
        this.NR2 = data
        if ((data & 0xF0) == 0) {
            this.PCM = 0
            this.on = 0
        }
    }

    trigger(data: int) {
        this.NR4 = data
        this.length = this.NR4 & (1 << 6) ? 63 - (this.NR1 & 63) : 0
        if (data & (1 << 7)) {
            this.on = 1
            this.vol = this.NR2 >> 4
            this.divSweep = (this.NR0 >> 4) & 7
            this.divEnv = this.NR2 & 7
        }
    }

    tick(DIVAPUEdge: int) {
        if (!this.on) { return }

        if (this.div == 0) {
            let period: int = ((this.NR4 & 0x07) << 8) | this.NR3
            this.div = 2048 - period

            if (period == 2047) { 
                this.PCM = 0x0F 
            } else {
                this.phase = (this.phase + 1) & 7
                this.PCM = (this.wave[this.NR1 >> 6] >> this.phase) & 1 ? this.vol : 0
            }
        }
        this.div = this.div - 1

        if (DIVAPUEdge & (1 << 1) && (this.NR0 >> 4) & 7) {
            if (this.divSweep == 0) {
                let period: int = ((this.NR4 & 0x07) << 8) | this.NR3
                let change: int = period / (1 << (this.NR0 & 7))
                if (this.NR0 & (1 << 3)) {
                    period = period - change
                } else {
                    period = period + change
                }
                if (period < 0 || period > 0x7FF) {
                    this.PCM = 0
                    this.on = 0
                } else {
                    this.NR3 = period & 0xFF
                    this.NR4 = (this.NR4 & 0xF8) | period >> 8
                }
                this.divSweep = (this.NR0 >> 4) & 7
            } else {
                this.divSweep = this.divSweep - 1
            }
        }
        if (DIVAPUEdge & (1 << 2) && this.NR2 & 7) {
            if (this.divEnv == 0) {
                if (this.NR2 & (1 << 3)) {
                    if (this.vol < 0xF) { this.vol = this.vol + 1 }
                } else {
                    if (this.vol > 0x0) { this.vol = this.vol - 1 }
                }
                this.divEnv = (this.NR2 & 7) + 1
            } else {
                this.divEnv = this.divEnv - 1
            }
        }
        if ((DIVAPUEdge & 1) && this.length) {
            this.length = this.length - 1
            if (this.length == 0) {
                this.PCM = 0
                this.on = 0
            }
        }
    }
}

class ChanWave {
    on: int
    wave: int[]

    NR0: int
    NR1: int
    NR2: int
    NR3: int
    NR4: int

    div: int
    phase: int
    length: int
    PCM: int

    reset() {
        this.on = 0
        this.NR0 = 0
        this.NR1 = 0
        this.NR2 = 0
        this.NR3 = 0
        this.NR4 = 0
        this.div = 0
        this.phase = 0
        this.PCM = 0
    }
    
    constructor() {
        this.wave = <int[]>[]
        for (let i: int = 0; i < 16; i = i + 1) {
            this.wave.push(0x00)
        }
        this.reset()
    }

    trigger(data: int) {
        this.NR4 = data
        this.length = this.NR4 & (1 << 6) ? 63 - (this.NR1 & 63) : 0
        if (data & (1 << 7)) {
            this.phase = 0
            this.on = 1
        }
    }

    tick(DIVAPUEdge: int) {
        if (!this.on) { return }

        if (this.div == 0) {
            let period: int = ((this.NR4 & 0x07) << 8) | this.NR3
            this.div = 2048 - period

            this.phase = (this.phase + 1) & 31
            let shift: int = 4
            if (this.on && this.NR0 & (1 << 7) && (this.NR2 >> 5) & 3) {
                shift = ((this.NR2 >> 5) & 3) - 1
            }

            this.PCM = ((this.wave[this.phase >> 1] >> (this.phase & 1 ? 0 : 4)) & 0x0F) >> shift
        }
        this.div = this.div - 1

        if ((DIVAPUEdge & 1) && this.length) {
            this.length = this.length - 1
            if (this.length == 0) {
                this.PCM = 0
                this.on = 0
            }
        }
    }
}

class ChanNoise {
    on: int

    NR1: int
    NR2: int
    NR3: int
    NR4: int

    LSFR: int

    div: int
    phase: int

    divEnv: int
    length: int
    vol: int
    PCM: int

    reset() {
        this.on = 0
        this.NR1 = 0
        this.NR2 = 0
        this.NR3 = 0
        this.NR4 = 0
        this.LSFR = 0
        this.div = 0
        this.phase = 0
        this.length = 0
        this.vol = 0
        this.PCM = 0
    }

    constructor() {
        this.reset()
    }

    volume(data: int) {
        this.NR2 = data
        if ((data & 0xF0) == 0) {
            this.PCM = 0
            this.on = 0
        }
    }

    trigger(data: int) {
        this.NR4 = data
        this.length = this.NR4 & (1 << 6) ? 63 - (this.NR1 & 63) : 0
        if (data & (1 << 7)) {
            this.on = 1
            this.vol = this.NR2 >> 4
            this.divEnv = this.NR2 & 7
            this.LSFR = 0
        }
    }

    tick(DIVAPUEdge: int) {
        if (!this.on) { return }

        if (this.div == 0) {
            this.div = (this.NR3 & 7) << 1
            if (this.div == 0) { this.div = 1 }
            this.div = this.div << ((this.NR3 >> 4) & 0x0F)

            this.PCM = this.LSFR & 1 ? this.vol : 0

            let x: int = ((this.LSFR & 1) == ((this.LSFR >> 1) & 1)) ? 1 : 0
            this.LSFR = this.LSFR | x << 15
            if (this.NR3 & (1 << 3)) {
                this.LSFR = this.LSFR & 0xFF7F | x << 7
            }
            this.LSFR = this.LSFR >> 1
        }
        this.div = this.div - 1

        if (DIVAPUEdge & (1 << 2) && this.NR2 & 7) {
            if (this.divEnv == 0) {
                if (this.NR2 & (1 << 3)) {
                    if (this.vol < 0xF) { this.vol = this.vol + 1 }
                } else {
                    if (this.vol > 0x0) { this.vol = this.vol - 1 }
                }
                this.divEnv = (this.NR2 & 7) + 1
            } else {
                this.divEnv = this.divEnv - 1
            }
        }

        if ((DIVAPUEdge & 1) && this.length) {
            this.length = this.length - 1
            if (this.length == 0) {
                this.PCM = 0
                this.on = 0
            }
        }
    }
}

class APU {
    ticks: int
    DIVAPU: int

    channel1: ChanPulse
    channel2: ChanPulse
    channel3: ChanWave
    channel4: ChanNoise

    NR50: int
    NR51: int
    NR52: int

    PCM12: int
    PCM34: int
    PCML: int
    PCMR: int

    reset() {
        this.NR50 = 0x77
        this.NR51 = 0xF3
        this.NR52 = 0xF1
        this.PCM12 = 0
        this.PCM34 = 0
        this.PCML = 0
        this.PCMR = 0
    }

    constructor() {
        this.ticks = 0
        this.DIVAPU = 0

        this.channel1 = new ChanPulse()
        this.channel2 = new ChanPulse()
        this.channel3 = new ChanWave()
        this.channel4 = new ChanNoise()

        this.reset()
    }

    read(addr: int): int {
        if (addr == 0xFF10) { return this.channel1.NR0 | 0x80 }
        if (addr == 0xFF11) { return this.channel1.NR1 | 0x3F }
        if (addr == 0xFF12) { return this.channel1.NR2 }
        if (addr == 0xFF13) { return 0xFF }
        if (addr == 0xFF14) { return this.channel1.NR4 | 0xBF }

        if (addr == 0xFF15) { return 0xFF }
        if (addr == 0xFF16) { return this.channel2.NR1 | 0x3F }
        if (addr == 0xFF17) { return this.channel2.NR2 }
        if (addr == 0xFF18) { return 0xFF }
        if (addr == 0xFF19) { return this.channel2.NR4 | 0xBF }

        if (addr == 0xFF1A) { return this.channel3.NR0 | 0x7F }
        if (addr == 0xFF1B) { return 0xFF }
        if (addr == 0xFF1C) { return this.channel3.NR2 | 0x9F }
        if (addr == 0xFF1D) { return 0xFF }
        if (addr == 0xFF1E) { return this.channel3.NR4 | 0xBF }

        if (addr == 0xFF1F) { return 0xFF }
        if (addr == 0xFF20) { return 0xFF }
        if (addr == 0xFF21) { return this.channel4.NR2 }
        if (addr == 0xFF22) { return this.channel4.NR3 }
        if (addr == 0xFF23) { return this.channel4.NR4 | 0xBF }

        if (addr == 0xFF24) { return this.NR50 }
        if (addr == 0xFF25) { return this.NR51 }
        if (addr == 0xFF26) { return this.NR52 | 0x70 }

        if (addr >= 0xFF27 && addr < 0xFF30) { return 0xFF }
        if (addr >= 0xFF30 && addr <= 0xFF3F) { return this.channel3.wave[addr - 0xFF30] }

        return 0
    }

    write(addr: int, data: int) {
        if ((this.NR52 & 0x80) == 0 && addr != 0xFF26) {
            return
        }

        if (addr == 0xFF10) { this.channel1.NR0 = data }
        if (addr == 0xFF11) { this.channel1.NR1 = data }
        if (addr == 0xFF12) { this.channel1.volume(data) }
        if (addr == 0xFF13) { this.channel1.NR3 = data }
        if (addr == 0xFF14) { this.channel1.trigger(data) }

        if (addr == 0xFF15) { this.channel2.NR0 = data }
        if (addr == 0xFF16) { this.channel2.NR1 = data }
        if (addr == 0xFF17) { this.channel2.volume(data) }
        if (addr == 0xFF18) { this.channel2.NR3 = data }
        if (addr == 0xFF19) { this.channel2.trigger(data) }

        if (addr == 0xFF1A) { this.channel3.NR0 = data }
        if (addr == 0xFF1B) { this.channel3.NR1 = data }
        if (addr == 0xFF1C) { this.channel3.NR2 = data }
        if (addr == 0xFF1D) { this.channel3.NR3 = data }
        if (addr == 0xFF1E) { this.channel3.trigger(data) }

        if (addr == 0xFF20) { this.channel4.NR1 = data }
        if (addr == 0xFF21) { this.channel4.volume(data) }
        if (addr == 0xFF22) { this.channel4.NR3 = data }
        if (addr == 0xFF23) { this.channel4.trigger(data) }

        if (addr == 0xFF24) { this.NR50 = data }
        if (addr == 0xFF25) { this.NR51 = data }
        if (addr == 0xFF26) {
            this.NR52 = (this.NR52 & 0x0F) | (data & 0xF0)
            if ((data & 0x80) == 0) {
                this.channel1.reset()
                this.channel2.reset()
                this.channel3.reset()
                this.channel4.reset()
                this.reset()
            }
        }

        if (addr >= 0xFF30 && addr <= 0xFF3F) { this.channel3.wave[addr - 0xFF30] = data }
    }

    tick() {
        let ticksNext: int = (this.ticks + 1) & 0x1FFF
        let ticksEdge: int = (this.ticks ^ ticksNext) & this.ticks
        this.ticks = ticksNext

        let DIVAPUEdge: int = 0
        if (this.ticks == 0) {
            let DIVAPUNext: int = (this.DIVAPU + 1) & 0xFF
            DIVAPUEdge = (this.DIVAPU ^ DIVAPUNext) & this.DIVAPU
            this.DIVAPU = DIVAPUNext
        }

        if (ticksEdge & 2) {
            this.channel1.tick(DIVAPUEdge)
            this.channel2.tick(DIVAPUEdge)
        }
        if (ticksEdge & 1) {
            this.channel3.tick(DIVAPUEdge)
        }
        if (ticksEdge & 8) {
            this.channel4.tick(DIVAPUEdge)
        }

        this.NR52 = (this.NR52 & 0x80) | this.channel4.on << 3 | this.channel3.on << 2 | this.channel2.on << 1 | this.channel1.on

        // this.PCM12 = this.channel1.PCM
        // this.PCM34 = this.channel2.PCM

        this.PCML = 0
        this.PCMR = 0
        if (this.NR51 & (1 << 0)) { this.PCMR = this.PCMR + this.channel1.PCM }
        if (this.NR51 & (1 << 1)) { this.PCMR = this.PCMR + this.channel2.PCM }
        if (this.NR51 & (1 << 2)) { this.PCMR = this.PCMR + this.channel3.PCM }
        if (this.NR51 & (1 << 3)) { this.PCMR = this.PCMR + this.channel4.PCM }
        if (this.NR51 & (1 << 4)) { this.PCML = this.PCML + this.channel1.PCM }
        if (this.NR51 & (1 << 5)) { this.PCML = this.PCML + this.channel2.PCM }
        if (this.NR51 & (1 << 6)) { this.PCML = this.PCML + this.channel3.PCM }
        if (this.NR51 & (1 << 7)) { this.PCML = this.PCML + this.channel4.PCM }
    }
}