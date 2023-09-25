export { Interrupt };
class Interrupt {
    IME;
    IE;
    IF;
    reset() {
        this.IME = 0;
        this.IE = 0;
        this.IF = 0;
    }
    constructor() {
        this.reset();
    }
}
