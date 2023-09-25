export { RAM }

class RAM {
    WRAM: int[]
    XRAM: int[]
    HRAM: int[]

    constructor() {
        this.WRAM = <int[]>[]
        for (let i: int = 0; i < 0x2000; i = i + 1) { this.WRAM.push(0xFF) }
        this.XRAM = <int[]>[]
        for (let i: int = 0; i < 0x8000; i = i + 1) { this.XRAM.push(0xFF) }
        this.HRAM = <int[]>[]
        for (let i: int = 0; i < 0x80; i = i + 1) { this.HRAM.push(0xFF) }
    }
}