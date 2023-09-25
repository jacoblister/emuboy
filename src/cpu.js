export { CPU };
let _B = 0;
let _C = 1;
let _D = 2;
let _E = 3;
let _H = 4;
let _L = 5;
let _F = 6;
let _A = 7;
let _HL = _F;
let FLAG_Z = (1 << 7);
let FLAG_N = (1 << 6);
let FLAG_H = (1 << 5);
let FLAG_C = (1 << 4);
class CPU {
    interrupt;
    mapper;
    halt;
    ticks;
    IMEPendling;
    REG;
    SP;
    PC;
    hexValue(value) {
        let digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F"];
        return digits[value >> 4 & 0x0F] + digits[value & 0xF];
    }
    dumpState() {
        let state = "";
        state = state + "A:" + this.hexValue(this.REG[_A]);
        state = state + " F:" + this.hexValue(this.REG[_F]);
        state = state + " B:" + this.hexValue(this.REG[_B]);
        state = state + " C:" + this.hexValue(this.REG[_C]);
        state = state + " D:" + this.hexValue(this.REG[_D]);
        state = state + " E:" + this.hexValue(this.REG[_E]);
        state = state + " H:" + this.hexValue(this.REG[_H]);
        state = state + " L:" + this.hexValue(this.REG[_L]);
        state = state + " SP:" + this.hexValue(this.SP >> 8) + this.hexValue(this.SP & 0xFF);
        state = state + " PC:" + this.hexValue(this.PC >> 8) + this.hexValue(this.PC & 0xFF);
        state = state + " PCMEM:" + this.hexValue(this.mapper.read(this.PC));
        state = state + "," + this.hexValue(this.mapper.read(this.PC + 1));
        state = state + "," + this.hexValue(this.mapper.read(this.PC + 2));
        state = state + "," + this.hexValue(this.mapper.read(this.PC + 3));
        return state;
    }
    reset() {
        this.REG[_A] = 0x01;
        this.REG[_F] = FLAG_Z | FLAG_H | FLAG_C;
        this.REG[_B] = 0x00;
        this.REG[_C] = 0x13;
        this.REG[_D] = 0x00;
        this.REG[_E] = 0xD8;
        this.REG[_H] = 0x01;
        this.REG[_L] = 0x4D;
        this.SP = 0xFFFE;
        this.PC = 0x0100;
        this.halt = 0;
        this.ticks = 0;
        this.IMEPendling = 0;
    }
    constructor(interrupt, mapper) {
        this.interrupt = interrupt;
        this.mapper = mapper;
        this.REG = [];
        for (let i = 0; i < 8; i = i + 1) {
            this.REG.push(0);
        }
        this.reset();
    }
    executePrefixCB() {
        let op = this.mapper.read(this.PC);
        this.PC = (this.PC + 1) & 0xFFFF;
        let cycles = 8;
        let dst = op & 0x07;
        let val = this.REG[dst];
        if (dst == _HL) {
            val = this.mapper.read(this.REG[_H] << 8 | (this.REG[_L]));
            cycles = cycles + 4;
        }
        if (op <= 0x3F) {
            let alOp = (op >> 3) & 0x07;
            if (alOp == 0) { // RLC
                let carry = val >> 7;
                val = ((val << 1) | carry) & 0xFF;
                this.REG[_F] = (val == 0 ? FLAG_Z : 0) | (carry ? FLAG_C : 0);
            }
            if (alOp == 1) { // RRC
                let carry = val & 0x01;
                val = (val >> 1) | (carry ? 0x80 : 0);
                this.REG[_F] = (val == 0 ? FLAG_Z : 0) | (carry ? FLAG_C : 0);
            }
            if (alOp == 2) { // RL
                let carry = val >> 7;
                val = ((val << 1) | (this.REG[_F] & FLAG_C ? 1 : 0)) & 0xFF;
                this.REG[_F] = (val == 0 ? FLAG_Z : 0) | (carry ? FLAG_C : 0);
            }
            if (alOp == 3) { // RR
                let carry = val & 0x01;
                val = (val >> 1) | (this.REG[_F] & FLAG_C ? 0x80 : 0);
                this.REG[_F] = (val == 0 ? FLAG_Z : 0) | (carry ? FLAG_C : 0);
            }
            if (alOp == 4) { // SLA
                let carry = val >> 7;
                val = (val << 1) & 0xFF;
                this.REG[_F] = (val == 0 ? FLAG_Z : 0) | (carry ? FLAG_C : 0);
            }
            if (alOp == 5) { // SRA
                let carry = val & 1;
                val = ((val >> 1) | (val & 0x80));
                this.REG[_F] = (val == 0 ? FLAG_Z : 0) | (carry ? FLAG_C : 0);
            }
            if (alOp == 6) { // SWAP
                val = ((val & 0x0F) << 4) | (val >> 4);
                this.REG[_F] = (val == 0 ? FLAG_Z : 0);
            }
            if (alOp == 7) { // SRL
                let carry = val & 0x01;
                val = ((val >> 1) & 0xFF);
                this.REG[_F] = (val == 0 ? FLAG_Z : 0) | (carry ? FLAG_C : 0);
            }
        }
        if (op >= 0x40 && op < 0x80) { // BIT
            let bit = (op >> 3) & 0x07;
            this.REG[_F] = (val & (1 << bit) ? 0 : FLAG_Z) | FLAG_H | (this.REG[_F] & FLAG_C);
            return cycles;
        }
        if (op >= 0x80) { // SET/RES
            let bit = (op >> 3) & 0x07;
            if (op & 0x40) {
                val = val | (1 << bit);
            }
            else {
                val = val & ((1 << bit) ^ 0xFF);
            }
        }
        if (dst == _HL) {
            this.mapper.write(this.REG[_H] << 8 | (this.REG[_L]), val);
            cycles = cycles + 4;
        }
        else {
            this.REG[dst] = val;
        }
        return cycles;
    }
    executeOp() {
        let op = this.mapper.read(this.PC);
        this.PC = (this.PC + 1) & 0xFFFF;
        if (op <= 0x3F) {
            if ((op & 0x0F) == 0x00) {
                if (op == 0x00) { // NOP
                    return 4;
                }
                if (op == 0x20 || op == 0x30) { // JP NZ/NC,r8
                    let flag = (op & 0x10) ? FLAG_C : FLAG_Z;
                    let val = this.mapper.read(this.PC);
                    val = val > 127 ? 0xFFFF - (255 - val) : val;
                    this.PC = (this.PC + 1) & 0xFFFF;
                    if (!(this.REG[_F] & flag)) {
                        this.PC = (this.PC + val) & 0xFFFF;
                        return 12;
                    }
                    return 8;
                }
            }
            if ((op & 0x0F) == 0x01) { // LD xx, d16
                let dst = (op & 0x70) >> 3;
                let dl = this.mapper.read(this.PC);
                let dh = this.mapper.read(this.PC + 1);
                this.PC = (this.PC + 2) & 0xFFFF;
                if (op == 0x31) {
                    this.SP = (dh << 8) + dl;
                    return 12;
                }
                this.REG[dst] = dh;
                this.REG[dst + 1] = dl;
                return 12;
            }
            if ((op & 0x0F) == 0x02) { // LD xx, A
                let dst = (op & 0x70) >> 3;
                if (op == 0x22 || op == 0x32) { // LD (HL+/-),A
                    this.mapper.write(this.REG[_H] << 8 | this.REG[_L], this.REG[_A]);
                    let inc = (op & 0x10) >> 4 ? 0xFFFF : 0x0001;
                    let res = ((this.REG[_H] << 8 | this.REG[_L]) + inc) & 0xFFFF;
                    this.REG[_H] = res >> 8;
                    this.REG[_L] = res & 0xFF;
                    return 8;
                }
                this.mapper.write(this.REG[dst] << 8 | this.REG[dst + 1], this.REG[_A]);
                return 8;
            }
            if ((op & 0x07) == 0x03) { // INC/DEC xx
                let inc = op & 0x08 ? 0xFFFF : 0x0001;
                if ((op & 0x30) == 0x30) {
                    this.SP = (this.SP + inc) & 0xFFFF;
                    return 8;
                }
                let dst = (op & 0x70) >> 3;
                let data = (this.REG[dst] << 8 | this.REG[dst + 1]);
                data = (data + inc) & 0xFFFF;
                this.REG[dst] = data >> 8;
                this.REG[dst + 1] = data & 0xFF;
                return 8;
            }
            if ((op & 0x06) == 0x04) { // INC/DEC x
                let isDec = op & 0x01;
                let dst = (op & 0x38) >> 3;
                let inc = isDec ? 0xFF : 0x01;
                let val = this.REG[dst];
                if (dst == _HL) {
                    val = this.mapper.read(this.REG[_H] << 8 | (this.REG[_L]));
                }
                let valPost = val + inc & 0xFF;
                let half = (val >> 4) ^ (valPost >> 4) ? 1 : 0;
                this.REG[_F] = (valPost == 0 ? FLAG_Z : 0) | (isDec ? FLAG_N : 0) | (half ? FLAG_H : 0) | (this.REG[_F] & FLAG_C);
                if (dst == _HL) {
                    this.mapper.write(this.REG[_H] << 8 | (this.REG[_L]), valPost);
                    return 12;
                }
                else {
                    this.REG[dst] = valPost;
                    return 4;
                }
            }
            if ((op & 0x07) == 0x06) { // LD x, d8
                let dst = (op & 0x38) >> 3;
                let val = this.mapper.read(this.PC);
                this.PC = (this.PC + 1) & 0xFFFF;
                if (dst == _HL) {
                    this.mapper.write(this.REG[_H] << 8 | (this.REG[_L]), val);
                    return 12;
                }
                else {
                    this.REG[dst] = val;
                    return 8;
                }
            }
            if ((op & 0x0F) == 0x07) {
                if (op == 0x07) { // RLCA
                    let carry = this.REG[_A] >> 7;
                    this.REG[_A] = ((this.REG[_A] << 1) | carry) & 0xFF;
                    this.REG[_F] = (carry ? FLAG_C : 0);
                    return 4;
                }
                if (op == 0x17) { // RLA
                    let carry = this.REG[_A] >> 7;
                    this.REG[_A] = ((this.REG[_A] << 1) | (this.REG[_F] & FLAG_C ? 0x01 : 0)) & 0xFF;
                    this.REG[_F] = (carry ? FLAG_C : 0);
                    return 4;
                }
                if (op == 0x27) { // DAA
                    let val = this.REG[_A];
                    if (this.REG[_F] & FLAG_N) {
                        if (this.REG[_F] & FLAG_H) {
                            val = val - 6;
                        }
                        if (this.REG[_F] & FLAG_C) {
                            val = val - 96;
                        }
                    }
                    else {
                        if ((this.REG[_F] & FLAG_C) || (val > 0x99)) {
                            val = val + 96;
                            this.REG[_F] = this.REG[_F] | FLAG_C;
                        }
                        if ((this.REG[_F] & FLAG_H) || ((val & 0xF) > 0x9)) {
                            val = val + 6;
                            this.REG[_F] = this.REG[_F] & (0xF0 ^ FLAG_H);
                        }
                    }
                    this.REG[_A] = val & 0xFF;
                    this.REG[_F] = (this.REG[_A] == 0 ? FLAG_Z : 0) | (this.REG[_F] & FLAG_N) | (this.REG[_F] & FLAG_C);
                    return 4;
                }
                if (op == 0x37) { // SCF
                    this.REG[_F] = (this.REG[_F] & FLAG_Z) | FLAG_C;
                    return 4;
                }
            }
            if ((op & 0x0F) == 0x08) {
                if (op == 0x08) { // LD (a16), SP
                    let addr = this.mapper.read(this.PC + 1) << 8 | this.mapper.read(this.PC);
                    this.PC = (this.PC + 2) & 0xFFFF;
                    this.mapper.write(addr, this.SP & 0xFF);
                    this.mapper.write(addr + 1, this.SP >> 8);
                    return 20;
                }
                let val = this.mapper.read(this.PC);
                this.PC = (this.PC + 1) & 0xFFFF;
                val = val > 127 ? 0xFFFF - (255 - val) : val;
                if (op == 0x18) { // JR r8
                    this.PC = (this.PC + val) & 0xFFFF;
                    return 12;
                }
                if (op == 0x28 || op == 0x38) { // JP Z/C,r8
                    let flag = (op & 0x10) ? FLAG_C : FLAG_Z;
                    if (this.REG[_F] & flag) {
                        this.PC = (this.PC + val) & 0xFFFF;
                        return 12;
                    }
                    return 8;
                }
            }
            if ((op & 0x0F) == 0x09) { // ADD HL, xx
                let src = (op & 0x70) >> 3;
                let hl = this.REG[_H] << 8 | this.REG[_L];
                let val = op == 0x39 ? this.SP : this.REG[src] << 8 | this.REG[src + 1];
                let carry = (hl + val) >> 16;
                let half = ((hl & 0xFFF) + (val & 0xFFF)) >> 12;
                val = (val + hl) & 0xFFFF;
                this.REG[_H] = val >> 8;
                this.REG[_L] = val & 0xFF;
                this.REG[_F] = (this.REG[_F] & FLAG_Z) | (half ? FLAG_H : 0) | (carry ? FLAG_C : 0);
                return 8;
            }
            if ((op & 0x0F) == 0x0A) { // LD A, (xx)
                let src = (op & 0x70) >> 3;
                if (op == 0x2A || op == 0x3A) { // LD (HL+/-),A
                    this.REG[_A] = this.mapper.read(this.REG[_H] << 8 | this.REG[_L]);
                    let inc = (op & 0x10) >> 4 ? 0xFFFF : 0x0001;
                    let res = ((this.REG[_H] << 8 | this.REG[_L]) + inc) & 0xFFFF;
                    this.REG[_H] = res >> 8;
                    this.REG[_L] = res & 0xFF;
                    return 8;
                }
                this.REG[_A] = this.mapper.read(this.REG[src] << 8 | this.REG[src + 1]);
                return 8;
            }
            if ((op & 0x0F) == 0x0F) {
                if (op == 0x0F) { // RRCA
                    let carry = this.REG[_A] & 0x01;
                    this.REG[_A] = (this.REG[_A] >> 1) | (carry ? 0x80 : 0);
                    this.REG[_F] = (carry ? FLAG_C : 0);
                    return 4;
                }
                if (op == 0x1F) { // RRA
                    let carry = this.REG[_A] & 0x01;
                    this.REG[_A] = (this.REG[_A] >> 1) | (this.REG[_F] & FLAG_C ? 0x80 : 0);
                    this.REG[_F] = (carry ? FLAG_C : 0);
                    return 4;
                }
                if (op == 0x2F) { // CPL
                    this.REG[_A] = this.REG[_A] ^ 0xFF;
                    this.REG[_F] = (this.REG[_F] & FLAG_Z) | FLAG_N | FLAG_H | (this.REG[_F] & FLAG_C);
                    return 4;
                }
                if (op == 0x3F) { // CCF
                    this.REG[_F] = (this.REG[_F] & FLAG_Z) | (this.REG[_F] & FLAG_C ? 0 : FLAG_C);
                    return 4;
                }
            }
        }
        if (op >= 0x40 && op <= 0x7F) { // LD x,x
            let src = op & 0x07;
            let dst = (op >> 3) & 0x07;
            if (op == 0x76) { // HALT
                this.halt = 1;
                return 4;
            }
            if (src == _HL) {
                this.REG[dst] = this.mapper.read(this.REG[_H] << 8 | (this.REG[_L]));
                return 8;
            }
            if (dst == _HL) {
                this.mapper.write(this.REG[_H] << 8 | (this.REG[_L]), this.REG[src]);
                return 8;
            }
            this.REG[dst] = this.REG[src];
            return 4;
        }
        if ((op >= 0x80 && op <= 0xBF) || (op >= 0xC0 && (op & 0x07) == 0x06)) {
            let src = op & 0x07;
            let alOp = (op >> 3) & 0x07;
            let cycles = 4;
            let val = this.REG[src];
            if (op >= 0xC0) {
                val = this.mapper.read(this.PC);
                this.PC = (this.PC + 1) & 0xFFFF;
                cycles = 8;
            }
            if (op < 0xC0 && src == _HL) {
                val = this.mapper.read(this.REG[_H] << 8 | (this.REG[_L]));
                cycles = 8;
            }
            if (alOp == 0) { // ADD A,X
                let valPost = this.REG[_A] + val;
                let half = ((this.REG[_A] & 0x0F) + (val & 0x0F)) >> 4;
                let carry = valPost > 0xFF ? 1 : 0;
                this.REG[_A] = valPost & 0xFF;
                this.REG[_F] = (this.REG[_A] == 0 ? FLAG_Z : 0) | (half ? FLAG_H : 0) | (carry ? FLAG_C : 0);
            }
            if (alOp == 1) { // ADC A,X
                let valPost = this.REG[_A] + val + (this.REG[_F] & FLAG_C ? 1 : 0);
                let half = ((this.REG[_A] & 0x0F) + (val & 0x0F) + (this.REG[_F] & FLAG_C ? 1 : 0)) >> 4;
                let carry = valPost > 0xFF ? 1 : 0;
                this.REG[_A] = valPost & 0xFF;
                this.REG[_F] = (this.REG[_A] == 0 ? FLAG_Z : 0) | (half ? FLAG_H : 0) | (carry ? FLAG_C : 0);
            }
            if (alOp == 2) { // SUB A,X
                let valPost = this.REG[_A] + ((val ^ 0xFF) + 1);
                let half = ((this.REG[_A] & 0x0F) - (val & 0x0F)) < 0 ? 1 : 0;
                let carry = this.REG[_A] - val < 0 ? 1 : 0;
                this.REG[_A] = valPost & 0xFF;
                this.REG[_F] = (this.REG[_A] == 0 ? FLAG_Z : 0) | FLAG_N | (half ? FLAG_H : 0) | (carry ? FLAG_C : 0);
            }
            if (alOp == 3) { // SBC A,X
                let valPost = this.REG[_A] + ((val ^ 0xFF) + 1) + (this.REG[_F] & FLAG_C ? 0xFF : 0x00);
                let half = ((this.REG[_A] & 0x0F) - (val & 0x0F) - (this.REG[_F] & FLAG_C ? 1 : 0)) < 0 ? 1 : 0;
                let carry = this.REG[_A] - val - (this.REG[_F] & FLAG_C ? 1 : 0) < 0 ? 1 : 0;
                this.REG[_A] = valPost & 0xFF;
                this.REG[_F] = (this.REG[_A] == 0 ? FLAG_Z : 0) | FLAG_N | (half ? FLAG_H : 0) | (carry ? FLAG_C : 0);
            }
            if (alOp == 4) { // AND A,X
                this.REG[_A] = this.REG[_A] & val;
                this.REG[_F] = (this.REG[_A] == 0 ? FLAG_Z : 0) | FLAG_H;
            }
            if (alOp == 5) { // XOR A,X
                this.REG[_A] = this.REG[_A] ^ val;
                this.REG[_F] = this.REG[_A] == 0 ? FLAG_Z : 0;
            }
            if (alOp == 6) { // OR A,X
                this.REG[_A] = this.REG[_A] | val;
                this.REG[_F] = this.REG[_A] == 0 ? FLAG_Z : 0;
            }
            if (alOp == 7) { // CP d8
                let valPost = this.REG[_A] + ((val ^ 0xFF) + 1);
                let half = ((this.REG[_A] & 0x0F) - (val & 0x0F)) < 0 ? 1 : 0;
                let carry = this.REG[_A] - val < 0 ? 1 : 0;
                this.REG[_F] = ((valPost & 0xFF) == 0 ? FLAG_Z : 0) | FLAG_N | (half ? FLAG_H : 0) | (carry ? FLAG_C : 0);
            }
            return cycles;
        }
        if (op >= 0xC0) {
            if ((op & 0x0F) == 0x00) {
                if (op == 0xC0 || op == 0xD0) { // RET NZ/NC
                    let flag = (op & 0x10) ? FLAG_C : FLAG_Z;
                    if (!(this.REG[_F] & flag)) {
                        this.PC = this.mapper.read(this.SP + 1) << 8 | this.mapper.read(this.SP);
                        this.SP = (this.SP + 2) & 0xFFFF;
                        return 20;
                    }
                    return 8;
                }
                if (op == 0xE0) {
                    let addr = 0xFF00 | this.mapper.read(this.PC);
                    this.PC = (this.PC + 1) & 0xFFFF;
                    this.mapper.write(addr, this.REG[_A]);
                    return 12;
                }
                if (op == 0xF0) {
                    let addr = 0xFF00 | this.mapper.read(this.PC);
                    this.PC = (this.PC + 1) & 0xFFFF;
                    this.REG[_A] = this.mapper.read(addr);
                    return 12;
                }
            }
            if ((op & 0x0B) == 0x01) { // PUSH/POP xx
                let srcH = (op & 0x38) >> 3;
                let srcL = srcH + 1;
                if (op >> 4 == 0x0F) {
                    srcH = srcH + 1;
                    srcL = srcL - 1;
                }
                if (op & 0x04) {
                    this.SP = (this.SP + 0xFFFE) & 0xFFFF;
                    this.mapper.write(this.SP, this.REG[srcL]);
                    this.mapper.write(this.SP + 1, this.REG[srcH]);
                    return 16;
                }
                else {
                    this.REG[srcL] = this.mapper.read(this.SP);
                    this.REG[srcH] = this.mapper.read(this.SP + 1);
                    this.SP = (this.SP + 2) & 0xFFFF;
                    this.REG[_F] = this.REG[_F] & 0xF0;
                    return 12;
                }
            }
            if ((op & 0x0F) == 0x02) {
                if (op == 0xC2 || op == 0xD2) { // JP NZ,a16
                    let flag = (op & 0x10) ? FLAG_C : FLAG_Z;
                    let addr = this.mapper.read(this.PC + 1) << 8 | this.mapper.read(this.PC);
                    this.PC = (this.PC + 2) & 0xFFFF;
                    if (!(this.REG[_F] & flag)) {
                        this.PC = addr;
                        return 16;
                    }
                    return 12;
                }
                if (op == 0xE2) { // LD (C),A
                    this.mapper.write(0xFF00 | this.REG[_C], this.REG[_A]);
                    return 8;
                }
                if (op == 0xF2) { // LD A,(C)
                    this.REG[_A] = this.mapper.read(0xFF00 | this.REG[_C]);
                    return 8;
                }
            }
            if ((op & 0x0F) == 0x03) {
                if (op == 0xC3) { // JP a16
                    this.PC = this.mapper.read(this.PC + 1) << 8 | this.mapper.read(this.PC);
                    return 16;
                }
                if (op == 0xF3) { // DI
                    this.interrupt.IME = 0;
                    return 4;
                }
            }
            if ((op & 0x07) == 0x04) { // CALL N/Z/C, a16
                let addr = this.mapper.read(this.PC + 1) << 8 | this.mapper.read(this.PC);
                this.PC = (this.PC + 2) & 0xFFFF;
                let flag = (op & 0x10) ? FLAG_C : FLAG_Z;
                let tst = (this.REG[_F] & flag);
                if (!(op & 0x08)) {
                    tst = tst ? 0 : 1;
                }
                if (tst) {
                    this.SP = (this.SP + 0xFFFE) & 0xFFFF;
                    this.mapper.write(this.SP, this.PC & 0xFF);
                    this.mapper.write(this.SP + 1, (this.PC >> 8) & 0xFF);
                    this.PC = addr;
                    return 24;
                }
                return 12;
            }
            if ((op & 0x07) == 0x07) { // RST
                let addr = op & 0x38;
                this.SP = (this.SP + 0xFFFE) & 0xFFFF;
                this.mapper.write(this.SP, this.PC & 0xFF);
                this.mapper.write(this.SP + 1, (this.PC >> 8) & 0xFF);
                this.PC = addr;
                return 16;
            }
            if ((op & 0x0F) == 0x08) {
                if (op == 0xC8 || op == 0xD8) { // RET Z/C
                    let flag = (op & 0x10) ? FLAG_C : FLAG_Z;
                    if (this.REG[_F] & flag) {
                        this.PC = this.mapper.read(this.SP + 1) << 8 | this.mapper.read(this.SP);
                        this.SP = (this.SP + 2) & 0xFFFF;
                        return 20;
                    }
                    return 8;
                }
                if (op == 0xE8) { // ADD SP, r8
                    let val = this.mapper.read(this.PC);
                    val = val > 127 ? 0xFFFF - (255 - val) : val;
                    this.PC = (this.PC + 1) & 0xFFFF;
                    let carry = ((this.SP & 0xFF) + (val & 0xFF)) >> 8;
                    let half = ((this.SP & 0x0F) + (val & 0x0F)) >> 4;
                    this.SP = (this.SP + val) & 0xFFFF;
                    this.REG[_F] = (half ? FLAG_H : 0) | (carry ? FLAG_C : 0);
                    return 16;
                }
                if (op == 0xF8) { // LD HL, SP+r8
                    let val = this.mapper.read(this.PC);
                    val = val > 127 ? 0xFFFF - (255 - val) : val;
                    this.PC = (this.PC + 1) & 0xFFFF;
                    let carry = ((this.SP & 0xFF) + (val & 0xFF)) >> 8;
                    let half = ((this.SP & 0x0F) + (val & 0x0F)) >> 4;
                    let addr = (this.SP + val) & 0xFFFF;
                    this.REG[_L] = addr & 0xFF;
                    this.REG[_H] = addr >> 8;
                    this.REG[_F] = (half ? FLAG_H : 0) | (carry ? FLAG_C : 0);
                    return 12;
                }
            }
            if ((op & 0x0F) == 0x09) {
                if (op == 0xC9 || op == 0xD9) { // RET / RETI
                    this.PC = this.mapper.read(this.SP + 1) << 8 | this.mapper.read(this.SP);
                    this.SP = (this.SP + 2) & 0xFFFF;
                    if (op == 0xD9) {
                        this.interrupt.IME = 1;
                    }
                    return 16;
                }
                if (op == 0xE9) { // JP (HL)
                    this.PC = this.REG[_H] << 8 | this.REG[_L];
                    return 4;
                }
                if (op == 0xF9) { // LD SP, HL
                    this.SP = this.REG[_H] << 8 | this.REG[_L];
                    return 8;
                }
            }
            if ((op & 0x0F) == 0x0A) {
                if (op == 0xCA || op == 0xDA) { // JP Z,a16
                    let flag = (op & 0x10) ? FLAG_C : FLAG_Z;
                    let addr = this.mapper.read(this.PC + 1) << 8 | this.mapper.read(this.PC);
                    this.PC = (this.PC + 2) & 0xFFFF;
                    if (this.REG[_F] & flag) {
                        this.PC = addr;
                        return 16;
                    }
                    return 12;
                }
                if (op == 0xEA) { // LD (a16),A
                    this.mapper.write(this.mapper.read(this.PC + 1) << 8 | this.mapper.read(this.PC), this.REG[_A]);
                    this.PC = (this.PC + 2) & 0xFFFF;
                    return 16;
                }
                if (op == 0xFA) { // LD A,(a16)
                    this.REG[_A] = this.mapper.read(this.mapper.read(this.PC + 1) << 8 | this.mapper.read(this.PC));
                    this.PC = (this.PC + 2) & 0xFFFF;
                    return 16;
                }
            }
            if ((op & 0x0F) == 0x0B) {
                if (op == 0xCB) { // PREFIX CB
                    return this.executePrefixCB();
                }
                if (op == 0xFB) { // EI
                    this.IMEPendling = 1;
                    return 4;
                }
            }
            if ((op & 0x0F) == 0x0D) {
                if (op == 0xCD) { // CALL a16
                    this.SP = (this.SP + 0xFFFE) & 0xFFFF;
                    this.mapper.write(this.SP, (this.PC + 2) & 0xFF);
                    this.mapper.write(this.SP + 1, ((this.PC + 2) >> 8) & 0xFF);
                    this.PC = this.mapper.read(this.PC + 1) << 8 | this.mapper.read(this.PC);
                    return 24;
                }
            }
        }
        return 0;
    }
    nextCycle() {
        if (this.IMEPendling) {
            this.interrupt.IME = 1;
            this.IMEPendling = 0;
        }
        if (this.interrupt.IE & this.interrupt.IF) {
            this.halt = 0;
        }
        if (this.interrupt.IME) {
            for (let i = 0; i < 5; i = i + 1) {
                if (this.interrupt.IE & (this.interrupt.IF & (1 << i))) {
                    this.interrupt.IME = 0;
                    this.interrupt.IF = this.interrupt.IF & (0x1F ^ (1 << i));
                    this.SP = (this.SP + 0xFFFE) & 0xFFFF;
                    this.mapper.write(this.SP, this.PC & 0xFF);
                    this.mapper.write(this.SP + 1, (this.PC >> 8) & 0xFF);
                    this.PC = 0x40 + (i << 3);
                    return 20;
                }
            }
        }
        if (this.halt) {
            return 4;
        }
        return this.executeOp();
    }
    tick() {
        if (this.ticks == 0) {
            this.ticks = this.nextCycle();
        }
        this.ticks = this.ticks - 1;
    }
}
