import * as interrupt from "./interrupt"

export { Timer }

class Timer {
    interrupt: interrupt.Interrupt
    ticks: int

    DIV: int
    TIMA: int
    TMA: int
    TAC: int

    reset() {
        this.DIV = 0
        this.TIMA = 0
        this.TMA = 0
        this.TAC = 0xF8
    }

    constructor(interrupt: interrupt.Interrupt) {
        this.interrupt = interrupt
        this.ticks = 0

        this.reset()
    }

    tick() {
        let mask: int = (1 << ((((this.TAC + 3) & 0x03) << 1) + 4)) - 1

        this.ticks = (this.ticks + 1) & 0xFFFF
        if ((this.ticks & 0xFF) == 0) {
            this.DIV = (this.DIV + 1) & 0xFF
        }
        if (this.TAC & (1 << 2) && (this.ticks & mask) == 0) {
            this.TIMA = (this.TIMA + 1) & 0xFF
            if (this.TIMA == 0) {
                this.TIMA = this.TMA
                this.interrupt.IF = this.interrupt.IF | 4
            }
        }
    }
}