export { RAM };
class RAM {
    WRAM;
    XRAM;
    HRAM;
    constructor() {
        this.WRAM = [];
        for (let i = 0; i < 0x2000; i = i + 1) {
            this.WRAM.push(0xFF);
        }
        this.XRAM = [];
        for (let i = 0; i < 0x8000; i = i + 1) {
            this.XRAM.push(0xFF);
        }
        this.HRAM = [];
        for (let i = 0; i < 0x80; i = i + 1) {
            this.HRAM.push(0xFF);
        }
    }
}
