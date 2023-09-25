import * as interrupt from "./interrupt"
// import * as ppuData from "./test/ppuDataTennis"

export { PPU }

let PAL_BGP: int = 0
let PAL_OBP0: int = 1
let PAL_OBP1: int = 2

class PPU {
    vBuffer: int[]
    vBufferIndex: int

    interrupt: interrupt.Interrupt
    interruptLine: int

    VRAM: int[]
    OAM: int[]

    LCDC: int
    STAT: int
    LY: int
    LYC: int
    SCY: int
    SCX: int
    WY: int
    WX: int
    WLY: int

    bgPixelIndex: int
    bgTileMap: int
    bgTileMapIndex: int
    bgTileLine: int
    bgTileLineData: int
    secOAM: int[]

    palette: int[][]
    BGP: int
    OBP0: int
    OBP1: int

    ticks: int
    frame: int

    reset() {
        this.interruptLine = 0

        this.LCDC = 0x91
        this.STAT = 0x81
        this.LY = 0x91
        this.SCY = 0
        this.SCX = 0
        this.WY = 0
        this.WX = 0
        this.WLY = 0x90

        this.BGP = 0xFC
        this.OBP0 = 0xFF
        this.OBP1 = 0xFF

        this.ticks = 216
        this.frame = 0
    }

    constructor(interrupt: interrupt.Interrupt) {
        this.vBuffer = <int[]>[]
        for (let i: int = 0; i < 23040; i = i + 1) { this.vBuffer.push(0) }
        this.vBufferIndex = 0

        this.interrupt = interrupt

        this.VRAM = <int[]>[]
        for (let i: int = 0; i < 0x2000; i = i + 1) { this.VRAM.push(0) }
        // this.VRAM = ppuData.VRAMData()

        this.OAM = <int[]>[]
        for (let i: int = 0; i < 160; i = i + 1) { this.OAM.push(0) }

        this.secOAM = <int[]>[]
        for (let i: int = 0; i < 10; i = i + 1) { this.secOAM.push(0) }

        this.palette = <int[][]>[]
        for (let i: int = 0; i < 3; i = i + 1) {
            let palette: int[] = <int[]>[]
            palette.push(0xFFFFFFFF)
            palette.push(0xFFFFFFFF)
            palette.push(0xFFFFFFFF)
            palette.push(0xFFFFFFFF)
            this.palette.push(palette)
        }
        this.palette[0][0] = 0xFF000000
    
        this.reset()
    }

    dmgPaletteSet(palNo: int, data: int) {
        if (palNo == 0) { this.BGP = data }
        if (palNo == 1) { this.OBP0 = data }
        if (palNo == 2) { this.OBP1 = data }

        for (let i: int = 0; i < 4; i = i + 1) {
            let rgb: int = 0xFF000000
            let shade: int = 3 - ((data >> (i << 1)) & 3)
            for (let j: int = 0; j < 12; j = j + 1) {
                rgb = rgb | (shade << (j << 1))
            }
            this.palette[palNo][i] = rgb
        }
    }

    LCDCSet(data: int) {
        if ((data & 0x80) != (this.LCDC & 0x80)) {
            if (data & 0x80) {
                this.LY = 144
                this.STAT = this.STAT & 0x78 | 1
            } else {
                this.LY = 0
                this.STAT = this.STAT & 0x78 
            }
        }
        this.LCDC = data 
    }

    fetchTileLineData(tileNumber: int, line: int, bgAddressingMode: int, hFlip: int): int {
        if (bgAddressingMode) {
            if (tileNumber > 127) { tileNumber = 0 - (0x100 - tileNumber) }
            tileNumber = tileNumber + 0x100
        }

        let vramIndex: int = (tileNumber << 4) + (line & 7) * 2
        let data: int = 0
        for (let i: int = 0; i < 8; i = i + 1) {
            let pixel: int = ((this.VRAM[vramIndex] >> i) & 1) | (((this.VRAM[vramIndex + 1] >> i) & 1) << 1)
            let pixelIndex: int = hFlip ? 7 - i : i
            data = data | (pixel << (pixelIndex << 1))
        }

        return data
    }

    nextFrame() {
        this.vBufferIndex = 0
    }

    oamScan() {
        for (let i: int = 0; i < 10; i = i + 1) {
            this.secOAM[i] = 0
        }

        let secOAMIndex: int = 0
        for (let i: int = 0; i < 40; i = i + 1) {
            let oamLine: int = this.LY - (this.OAM[i << 2] - 16)
            let objSize: int = 8
            let tileBase: int = this.OAM[(i << 2) + 2]
            if (this.LCDC & 4) {
                objSize = 16
                tileBase = tileBase & 0xFE
            }
            if (oamLine >= 0 && oamLine < objSize) {
                if (secOAMIndex < 10) {
                    let hFlip: int = this.OAM[(i << 2) + 3] & 0x20 ? 1 : 0
                    let line: int = this.OAM[(i << 2) + 3] & 0x40 ? (objSize - 1) - oamLine : oamLine

                    let tileOffset: int = 0
                    if (line >= 8) {
                        line = line - 8
                        tileOffset = 1
                    }
                    this.secOAM[secOAMIndex] = this.fetchTileLineData(tileBase + tileOffset, line, 0, hFlip)
                    this.secOAM[secOAMIndex] = this.secOAM[secOAMIndex] | (this.OAM[(i << 2) + 1] << 16) | (this.OAM[(i << 2) + 3] << 24)
                    secOAMIndex = secOAMIndex + 1
                }
            }
        }
    }

    nextBGTile() {
        if (this.ticks == 160) {
            this.bgPixelIndex = 7 - (this.SCX & 7)
            this.bgTileMap = this.LCDC & 0x08 ? 0x1C00 : 0x1800
            this.bgTileMapIndex = ((this.SCX >> 3) & 0x1F) | ((((this.LY + this.SCY) >> 3) & 0x1F) << 5)
            this.bgTileLine = (this.LY + this.SCY) & 7
        }

        if (this.LCDC & 0x20 && this.LY >= this.WY) {
            let active: int = 0
            if (this.ticks == 160 && this.WX < 7) {
                this.bgPixelIndex = this.WX
                active = 1
            }
            if (167 - this.ticks == this.WX) {
                this.bgPixelIndex = 7
                active = 1
            }
            if (active) {
                this.bgTileMap = this.LCDC & 0x40 ? 0x1C00 : 0x1800
                this.bgTileMapIndex = ((0 >> 3) & 0x1F) | (((this.WLY >> 3) & 0x1F) << 5)
                this.bgTileLine = this.WLY & 7
            }
        }

        if (this.bgPixelIndex == 7 || this.ticks == 160) {
            this.bgTileLineData = this.fetchTileLineData(this.VRAM[this.bgTileMap + this.bgTileMapIndex], this.bgTileLine, this.LCDC & 0x10 ? 0 : 1, 0)
        }

        if (this.bgPixelIndex == 0) {
            this.bgTileMapIndex = (this.bgTileMapIndex & 0x3E0) | ((this.bgTileMapIndex + 1) & 0x1F)
        }
    }

    nextPixel() {
        let bgPixel: int = 0
        if (this.LCDC & 0x01) {
            bgPixel = (this.bgTileLineData >> (this.bgPixelIndex << 1)) & 3
        }
        let oamPixel: int = 0
        let oamPalette: int = 0

        let oamXMin: int = 168
        if (this.LCDC & 0x02) {
            for (let i: int = 0; i < 10; i = i + 1) {
                let oamX: int = (this.secOAM[i] >> 16) & 0xFF
                let oamCol: int = (160 - this.ticks) - (oamX - 8)
                if (oamCol >= 0 && oamCol < 8) {
                    let priority: int = oamPixel == 0 ? 1 : 0
                    if (oamX < oamXMin) {
                        oamXMin = oamX
                        priority = 1
                    }
                    if (this.secOAM[i] & (1 << 31) && bgPixel > 0) {
                        priority = 0
                    }
                    let secPixel: int = (this.secOAM[i] >> ((7 - oamCol) << 1)) & 3
                    if (secPixel != 0 && priority) {
                        oamPixel = secPixel
                        oamPalette = this.secOAM[i] & (1 << 28) ? 2 : 1
                    }
                }
            }
        }

        let pixel: int = this.palette[0][bgPixel]
        if (oamPixel != 0) {
            pixel = this.palette[oamPalette][oamPixel]
        }
        this.vBuffer[this.vBufferIndex] = pixel

        if ((this.LCDC & 0x80) == 0) {
            this.vBuffer[this.vBufferIndex] = 0xFFFFFFFF
        }

        this.bgPixelIndex = (this.bgPixelIndex + 7) & 7
        this.vBufferIndex = this.vBufferIndex + 1
    }

    tick() {
        if ((this.LCDC & (1 << 7)) == 0) {
            return
        }
        
        if ((this.STAT & 3) == 2 && this.LY == 0 && this.ticks == 1) {
            this.nextFrame()
        }
        if ((this.STAT & 3) == 2 && this.ticks == 1) {
            this.oamScan()
        }
        if ((this.STAT & 3) == 3) {
            this.nextBGTile()
            this.nextPixel()
        }

        this.ticks = this.ticks - 1
        if (this.ticks == 0) {
            if ((this.STAT & 3) == 0) {
                this.LY = this.LY + 1
                if (this.LY == this.WY) {
                    this.WLY = 0
                } else if (this.LCDC & 0x20 && (this.WX <= 166 && this.WY <= 143)) {
                    this.WLY = this.WLY + 1
                }

                if (this.LY == 144) {
                    this.STAT = (this.STAT & 0xFC) | 1
                    this.ticks = 456
                } else {
                    this.STAT = (this.STAT & 0xFC) | 2
                    this.ticks = 80
                }
            } else if ((this.STAT & 3) == 1) {
                this.LY = this.LY + 1
                if (this.LY == 154) {
                    this.STAT = (this.STAT & 0xFC) | 2
                    this.LY = 0
                    this.WLY = 0
                    this.ticks = 80
                    this.frame = 1
                } else {
                    this.ticks = 456
                }
            } else if ((this.STAT & 3) == 2) {
                this.ticks = 160
                this.STAT = (this.STAT & 0xFC) | 3
            } else if ((this.STAT & 3) == 3) {
                this.ticks = 216
                this.STAT = (this.STAT & 0xFC) | 0
            }
            this.STAT = this.STAT & 0xFB | (this.LY == this.LYC ? 4 : 0)
        }

        if ((this.STAT & 3) == 1 && this.LY == 144 && this.ticks == 416) {
            this.interrupt.IF = this.interrupt.IF | 1
        }
        let intLYC: int = (this.STAT & 3) != 0 && this.LY == this.LYC && (this.STAT & (1 << 6)) ? 1 : 0
        let intHBlank: int = (this.STAT & 3) == 0 && this.ticks < 200 && (this.STAT & (1 << 3)) ? 1 : 0
        let interruptLine: int = intLYC | intHBlank
        if (interruptLine && interruptLine != this.interruptLine) {
            this.interrupt.IF = this.interrupt.IF | 2
        }
        this.interruptLine = interruptLine
    }
}