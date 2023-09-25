export { GamePad }

class GamePad {
    buttonState: int
    buttonSelect: int

    constructor() {
        this.buttonState = 0xFF
    }

    select(data: int) {
        this.buttonSelect = data
    }

    read(): int {
        if ((this.buttonSelect & 0x20) == 0) {
            return 0x0F & (this.buttonState >> 4)
        }
        if ((this.buttonSelect & 0x10) == 0) {
            return 0x0F & (this.buttonState & 0x0F)
        }
        return 0xFF
    }

    buttonEvent(buttonIndex: int, buttonDown: int) {
        if (buttonDown) {
            this.buttonState = this.buttonState & ((1 << buttonIndex) ^ 0xFF)
        } else {
            this.buttonState = this.buttonState | (1 << buttonIndex)
        }
    }
}