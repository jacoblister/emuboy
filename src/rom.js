export { ROM };
class ROM {
    data;
    constructor() {
        this.data = [];
        for (let i = 0; i < 0x8000; i = i + 1) {
            this.data.push(0x00);
        }
    }
}
