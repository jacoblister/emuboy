export { Mapper };
class Mapper {
    timer;
    rom;
    ram;
    ppu;
    apu;
    gamepad;
    interrupt;
    romBank;
    ramBank;
    dmaSrc;
    dmaDst;
    dmaCount;
    reset() {
        this.romBank = 1;
        this.ramBank = 0;
        this.dmaSrc = 0;
        this.dmaDst = 0;
        this.dmaCount = 0;
    }
    constructor(timer, rom, ram, ppu, apu, gamepad, interrupt) {
        this.timer = timer;
        this.rom = rom;
        this.ram = ram;
        this.ppu = ppu;
        this.apu = apu;
        this.gamepad = gamepad;
        this.interrupt = interrupt;
        this.reset();
    }
    read(addr) {
        if (addr >= 0x0000 && addr < 0x4000) {
            return this.rom.data[addr];
        }
        if (addr >= 0x4000 && addr < 0x8000) {
            return this.rom.data[(addr & 0x3FFF) + (this.romBank << 14)];
        }
        if (addr >= 0x8000 && addr < 0xA000) {
            return this.ppu.VRAM[addr - 0x8000];
        }
        if (addr >= 0xA000 && addr < 0xC000) {
            return this.ram.XRAM[(addr & 0x1FFF) + (this.ramBank << 13)];
        }
        if (addr >= 0xC000 && addr < 0xE000) {
            return this.ram.WRAM[addr - 0xC000];
        }
        // if (addr >= 0xE000 && addr < 0xFE00) { return this.ram.WRAM[addr - 0xE000] }
        if (addr == 0xFF00) {
            return this.gamepad.read();
        }
        if (addr == 0xFF01) {
            return 0;
        }
        if (addr == 0xFF02) {
            return 0;
        }
        if (addr == 0xFF04) {
            return this.timer.DIV;
        }
        if (addr == 0xFF05) {
            return this.timer.TIMA;
        }
        if (addr == 0xFF06) {
            return this.timer.TMA;
        }
        if (addr == 0xFF07) {
            return this.timer.TAC;
        }
        if (addr == 0xFF0F) {
            return this.interrupt.IF;
        }
        if (addr >= 0xFF10 && addr <= 0xFF3F) {
            return this.apu.read(addr);
        }
        if (addr == 0xFF40) {
            return this.ppu.LCDC;
        }
        if (addr == 0xFF41) {
            return this.ppu.STAT;
        }
        if (addr == 0xFF42) {
            return this.ppu.SCY;
        }
        if (addr == 0xFF43) {
            return this.ppu.SCX;
        }
        if (addr == 0xFF44) {
            return this.ppu.LY;
        }
        if (addr == 0xFF45) {
            return this.ppu.LYC;
        }
        if (addr == 0xFF47) {
            return this.ppu.BGP;
        }
        if (addr == 0xFF48) {
            return this.ppu.OBP0;
        }
        if (addr == 0xFF49) {
            return this.ppu.OBP1;
        }
        if (addr == 0xFF4A) {
            return this.ppu.WY;
        }
        if (addr == 0xFF4B) {
            return this.ppu.WX;
        }
        if (addr >= 0xFF80 && addr <= 0xFFFE) {
            return this.ram.HRAM[addr - 0xFF80];
        }
        if (addr == 0xFFFF) {
            return this.interrupt.IE;
        }
        console.log("READ FAIL");
        console.log(addr);
        return 0;
    }
    write(addr, data) {
        if (addr < 0x2000) { }
        if (addr >= 0x2000 && addr < 0x4000) {
            this.romBank = data;
            // this.romBank = data & 0x1F
            // this.romBank = (this.romBank & 0xE0) | (data & 0x1F)
            if (this.romBank == 0) {
                this.romBank = 1;
            }
        }
        if (addr >= 0x4000 && addr < 0x6000) {
            // this.romBank = (this.romBank & 0x1F) | (data & 3) << 5
            this.ramBank = data & 0x03;
        }
        if (addr >= 0x6000 && addr < 0x8000) {
            console.log("Bank Switch Mode Select");
            console.log(addr);
            console.log(data);
        }
        if (addr >= 0x8000 && addr < 0xA000) {
            this.ppu.VRAM[addr - 0x8000] = data;
        }
        if (addr >= 0xA000 && addr < 0xC000) {
            this.ram.XRAM[(addr & 0x1FFF) + (this.ramBank << 13)] = data;
        }
        if (addr >= 0xC000 && addr < 0xE000) {
            this.ram.WRAM[addr - 0xC000] = data;
        }
        if (addr >= 0xE000 && addr < 0xFE00) {
            console.log("Echo RAM write");
        }
        if (addr >= 0xFE00 && addr <= 0xFE9F) {
            this.ppu.OAM[addr - 0xFE00] = data;
        }
        if (addr == 0xFF00) {
            this.gamepad.select(data);
        }
        if (addr == 0xFF04) {
            this.timer.DIV = data;
        }
        if (addr == 0xFF05) {
            this.timer.TIMA = data;
        }
        if (addr == 0xFF06) {
            this.timer.TMA = data;
        }
        if (addr == 0xFF07) {
            this.timer.TAC = data;
        }
        if (addr == 0xFF0F) {
            this.interrupt.IF = data;
        }
        if (addr >= 0xFF10 && addr <= 0xFF3F) {
            return this.apu.write(addr, data);
        }
        if (addr == 0xFF40) {
            this.ppu.LCDCSet(data);
        }
        if (addr == 0xFF41) {
            this.ppu.STAT = (this.ppu.STAT & 0x07) | (data & 0xF8);
        }
        if (addr == 0xFF42) {
            this.ppu.SCY = data;
        }
        if (addr == 0xFF43) {
            this.ppu.SCX = data;
        }
        if (addr == 0xFF45) {
            this.ppu.LYC = data;
        }
        if (addr == 0xFF46) {
            this.dmaSrc = data << 8;
            this.dmaDst = 0xFE00;
            this.dmaCount = 160;
        }
        if (addr == 0xFF47) {
            this.ppu.dmgPaletteSet(0, data);
        }
        if (addr == 0xFF48) {
            this.ppu.dmgPaletteSet(1, data);
        }
        if (addr == 0xFF49) {
            this.ppu.dmgPaletteSet(2, data);
        }
        if (addr == 0xFF4A) {
            this.ppu.WY = data;
        }
        if (addr == 0xFF4B) {
            this.ppu.WX = data;
        }
        if (addr >= 0xFF80 && addr <= 0xFFFE) {
            this.ram.HRAM[addr - 0xFF80] = data;
        }
        if (addr == 0xFFFF) {
            this.interrupt.IE = data;
        }
    }
    tick() {
        if (this.dmaCount) {
            this.write(this.dmaDst, this.read(this.dmaSrc));
            this.dmaSrc = this.dmaSrc + 1;
            this.dmaDst = this.dmaDst + 1;
            this.dmaCount = this.dmaCount - 1;
        }
    }
}
