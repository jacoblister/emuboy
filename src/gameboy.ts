import * as interrupt from "./interrupt"
import * as timer from "./timer"
import * as rom from "./rom"
import * as ram from "./ram"
import * as ppu from "./ppu"
import * as apu from "./apu"
import * as gamepad from "./gamepad"
import * as mapper from "./mapper"
import * as cpu from "./cpu"

class GameBoy {
    interrupt: interrupt.Interrupt
    timer: timer.Timer
    rom: rom.ROM
    ram: ram.RAM
    ppu: ppu.PPU
    apu: apu.APU
    gamepad: gamepad.GamePad
    mapper: mapper.Mapper
    cpu: cpu.CPU

    audioSampleRate: int
    audioSamplePos: int

    reset() {
        this.timer.reset()
        this.ppu.reset()
        this.apu.reset()
        this.interrupt.reset()
        this.mapper.reset()
        this.cpu.reset()
    }

    constructor() {
        this.interrupt = new interrupt.Interrupt()
        this.timer = new timer.Timer(this.interrupt)
        this.rom = new rom.ROM()
        this.ram = new ram.RAM()
        this.ppu = new ppu.PPU(this.interrupt)
        this.apu = new apu.APU()
        this.gamepad = new gamepad.GamePad()
        this.mapper = new mapper.Mapper(this.timer, this.rom, this.ram, this.ppu, this.apu, this.gamepad, this.interrupt)
        this.cpu = new cpu.CPU(this.interrupt, this.mapper)

        this.reset()

        this.audioSampleRate = 44100
        this.audioSamplePos = 0
    }

    tick() {
        this.cpu.tick()
        this.timer.tick()
        this.ppu.tick()
        this.apu.tick()
        this.mapper.tick()
    }

    loadRom(romData: int[]) {
        this.rom.data = romData
        this.reset()
    }
    
    setVBuffer(vBuffer: int[]) {
        this.ppu.vBuffer = vBuffer
        this.ppu.frame = 0
    }
    
    advanceAudioSample(aBuffer: float[]): int {
        let volL: int = (this.apu.NR50 >> 4) & 7
        if (volL == 0) { volL = 1 }
        let volR: int = this.apu.NR50 & 7
        if (volR == 0) { volR = 1 }

        aBuffer[0] = (this.apu.PCML * volL) * 0.001
        aBuffer[1] = (this.apu.PCMR * volR) * 0.001

        while (this.audioSamplePos < 4194304) {
            this.audioSamplePos = this.audioSamplePos + this.audioSampleRate
            this.tick()
        }
        this.audioSamplePos = this.audioSamplePos - 4194304

        return this.ppu.frame
    }

    advanceFrame(vBuffer: int[], aSamples: int, aBuffer: float[]) {
        let aIndex: int = 0
        let aPos: int = 0
        this.ppu.vBuffer = vBuffer

        let volL: int = (this.apu.NR50 >> 4) & 7
        if (volL == 0) { volL = 1 }

        while(this.ppu.frame == 0) {
            this.tick()

            aPos = aPos + aSamples
            if (aPos >= 70224) {
                aBuffer[aIndex] = (this.apu.PCML * volL) * 0.001
                aIndex = aIndex + 1
                aPos = aPos - 70224
            }
        }
        this.ppu.frame = 0
    }

    buttonEvent(buttonIndex: int, buttonDown: int) {
        this.gamepad.buttonEvent(buttonIndex, buttonDown)
    }
}

let gb: GameBoy = new GameBoy()