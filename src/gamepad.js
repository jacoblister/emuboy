export { GamePad };
class GamePad {
    buttonState;
    buttonSelect;
    constructor() {
        this.buttonState = 0xFF;
    }
    select(data) {
        this.buttonSelect = data;
    }
    read() {
        if ((this.buttonSelect & 0x20) == 0) {
            return 0x0F & (this.buttonState >> 4);
        }
        if ((this.buttonSelect & 0x10) == 0) {
            return 0x0F & (this.buttonState & 0x0F);
        }
        return 0xFF;
    }
    buttonEvent(buttonIndex, buttonDown) {
        if (buttonDown) {
            this.buttonState = this.buttonState & ((1 << buttonIndex) ^ 0xFF);
        }
        else {
            this.buttonState = this.buttonState | (1 << buttonIndex);
        }
    }
}
