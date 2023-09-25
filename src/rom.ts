export { ROM }

class ROM {
    data: int[]

    constructor() {
        this.data = <int[]>[]
        for (let i: int = 0; i < 0x8000; i = i + 1) { this.data.push(0x00) }
    }
}