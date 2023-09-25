export { Interrupt }

class Interrupt {
    IME: int
    IE: int
    IF: int

    reset() {
        this.IME = 0
        this.IE = 0
        this.IF = 0
    }
    
    constructor() {
        this.reset()
    }
}

