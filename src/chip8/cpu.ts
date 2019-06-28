import utils from '../utils/utils';
import { fontset } from '../utils/fontSet';

export default class Cpu {
	fontSet: Uint8Array = fontset;

	i: number = 0x000;
	// memBuffer: ArrayBuffer = new ArrayBuffer(0x1000);
	memory: number[] = new Array(0x1000);
	pc: number = 0x200;
	pStart: number = 0x200;
	stack: number[] = new Array(0x10);
	sp: number = 0;
	v: Uint8Array = new Uint8Array(0x10);

	display: boolean[] = utils.setArray(new Array(0x800), false);
	displayHeight: number = 32;
	displayWidth: number = 64;

	input: boolean[] = utils.setArray(new Array(0x10), false);
	delayTimer: number = 0;
	soundTimer: number = 0;
	randomNG: number = utils.rng();

	paused = -1;
	speed = 10;

	// chip-8 opcodes are 16bit so the interpreter needs to concatenate two locations in memory to form them
	opcode: number = (this.memory[this.pc] << 8) | this.memory[this.pc + 1];

	loadRom = (rom: Uint8Array) => {
		this.memory.set(rom, 0x200);
	};

	run = () => {
		if (this.paused >= 0) {
			// pressed goes here
		}
		// this.cycle
		this.pc += 2;
	};

	getDisplayBuffer = (): boolean[] => {
		return this.display;
	};

	setInputState = (state: boolean[]): void => {
		this.input = state;
	};

	updateTimers = (): void => {
		this.delayTimer = Math.max(0, this.delayTimer - 1);
		this.soundTimer = Math.max(0, this.soundTimer - 1);
	};

	uint8 = (val: number): number => {
		return val % 256;
	};

	uint12 = (val: number): number => {
		return val % 4096;
	};

	cycle = (opcode: number) => {
		// get 12 lowest bits of opcode
		const nnn = this.opcode & 0x0fff;
		// get 8 lowest bits of opcode
		const nn = this.opcode & 0x0ff;
		// get 4 lowest nibble of opcode
		const n = this.opcode & 0x000f;

		// lower 4 bits of the high byte of opcode
		const x = (this.opcode & 0x0f00) >> 8;
		// upper 4 bits of the low byte of the instruction
		const y = (this.opcode & 0x00f0) >> 4;

		switch (opcode & 0xf000) {
			case 0x0000:
				switch (opcode) {
					case 0x00e0:
						// CLS clear the screen;
						for (let i = 0; i < this.display.length; i++) {
							this.display[i] = false;
						}
						break;
					case 0x00ee:
						// RET set pc to address at the top of stack
						this.sp--;
						this.pc = this.stack[this.sp];
						break;
				}
				break;
			case 0x1000:
				// JP addr 1nnn sets pc to nnn
				this.pc = nnn;
				break;
			case 0x2000:
				// CALL addr 2nnn increment sp then puts current pc on top of stack pc set to nnn
				this.stack[this.sp] = this.pc;
				this.sp++;
				this.pc = nnn;
				break;
			case 0x3000:
				// SE Vx, byte 3xkk skip next instruction if V[x] = nn
				if (this.v[x] === nn) {
					this.pc += 2;
				}
				break;
			case 0x4000:
				// SNE Vx, byte 4xkk compare v[x] to nn advance pc if not equal
				if (this.v[x] !== nn) {
					this.pc += 2;
				}
				break;
			case 0x5000:
				// SE V[x], V[y] 5xy0 compare v[x] to v[y] advance pc if equal
				if (this.v[x] === this.v[y]) {
					this.pc += 2;
				}
				break;
			case 0x6000:
				// LD v[x], byte 6xnn put nn into register v[x]
				this.v[x] = nn;
				break;
			case 0x7000:
				// ADD v[x], Byte add nn + v[x] to v[x]
				this.v[x] += nn;
				break;
			case 0x8000:
				switch (opcode & 0x000f) {
					case 0x0000:
						// LD v[x], v[y] 8xy0 store v[y] in v[x]
						this.v[x] = this.v[y];
						break;
					case 0x0001:
						// OR v[x], v[y] 8xy1 stores v[x] | v[y] in v[x];
						this.v[x] = this.v[x] | this.v[y];
						break;
					case 0x0002:
						// AND v[x], v[y] 8xy2 stores v[x] & v[y] in v[x];
						this.v[x] = this.v[x] & this.v[y];
						break;
					case 0x0003:
						// XOR v[x], v[y] 8xy3 stores v[x] ^ v[y] in v[x];
						this.v[x] = this.v[x] ^ this.v[y];
						break;
					case 0x0004:
						// ADD v[x], v[y] 8xy4 v[x] + v[y] if result > 255 v[f] = 1 else 0
						// lowest 8-bits are then stored in v[x];
						this.v[0xf] = this.v[x] + this.v[y] > 255 ? 1 : 0;
						this.v[x] += this.v[y];
						break;
					case 0x0005:
						// SUB v[x], v[y] 8xy5 v[x] = v[x] - v[y]
						this.v[0xf] = this.v[x] - this.v[y] < 0 ? 0 : 1;
						this.v[x] -= this.v[x] >> 1;
						break;
					case 0x0006:
						// SHR v[x], v[y] 8xy6 divide v[x] \ 2
						// if lowest bit of v[x] === 1 then vf = 1
						this.v[0xf] = this.v[x] & 0x01;
						this.v[x] = this.v[x] >> 1;
						break;
					case 0x0007:
						// SUB v[x], v[y] 8xy7 v[x] = v[y] - v[x]
						this.v[0xf] = this.v[y] - this.v[x] < 0 ? 0 : 1;
						this.v[x] = this.v[y] - this.v[x];
						break;
					case 0x000e:
						//  SHL v[x], v[y] set v[x] = v[x] shl 1
						this.v[0xf] = (this.v[x] & 0x80) >> 7;
						this.v[x] = this.v[x] << 1;
						break;
				}
				break;
			case 0x9000:
				// SNE v[x], v[y] Skip next instruction if v[x] is not equal to v[y];
				if (this.v[x] !== this.v[y]) {
					this.pc += 4;
				}
				break;
			case 0xa000:
				// LD i, nnn Annn i = nnn
				this.i = nnn;
				break;
			case 0xb000:
				// JP V0, nnn Bnnn jump to location v0 + nnn
				this.pc = nnn + this.v[0];
				break;
			case 0xc000:
				// RND Vx, byte CXNN set Vx =  random byte & nnn
				this.v[x] = this.randomNG & nnn;
				break;
			case 0xd000:
				// DRW Vx, Vy, n DXYN display n-byte sprite at memory location i at (Vx, Vy),
				// set Vf = collison
				this.v[0xf] = this.draw(
					this.v[x],
					this.v[y],
					this.memory.slice(this.i, this.i + n)
				);
				break;
			case 0xe000:
				switch (nn) {
					case 0x009e:
						// SKP Vx ex9e  skip next instruction if key with val of vx is pressed;
						if (this.pressed().indexOf(this.v[x]) >= 0) {
							this.pc += 2;
						}
						break;
					case 0x00a1:
						// SKNP Vx exa1 skip next instruction if key with val of Vx is not pressed
						if (!this.pressed().indexOf(this.v[x]) < 0) {
							this.pc += 2;
						}
						break;
				}
				break;
			case 0xf000:
				switch (opcode & nn) {
					case 0x0007:
						// LD Vx DT set vx = delayTimer
						this.v[x] = this.delayTimer;
						break;
					case 0x000a:
						// LD Vx, k Fx0a wait for a keypress then store in Vx
						this.paused = x;
						break;
					case 0x0015:
						// LD DT, Vx fx15 set delayTimer = Vx
						this.delayTimer = this.v[x];
						break;
					case 0x0018:
						// LD ST, Vx set soundTimer = Vx
						this.soundTimer = this.v[x];
						break;
					case 0x0029:
						// LD f, Vx fx29 set i = location of sprite for digit Vx;
						this.i = this.v[x] * 5;
						break;
					case 0x0033:
						// LD B, Vx Fx33 store bcd representation of Vx in memory[i];
						let start: number = this.v[x];
						this.memory[this.i] = start / 100;
						start = start % 100;
						this.memory[this.i + 1] = start / 10;
						start = start % 10;
						this.memory[this.i + 2] = start;
						break;
					case 0x0055:
						// LD [i], Vx Fx55 store all vReg in memory starting at i
						for (let j = 0; j <= x; j++) {
							this.memory[this.i + j] = this.v[j];
						}
						break;
					case 0x0065:
						// LD Vx, [i] Fx65 read all vReg from memory[i]
						for (let j = 0; j <= x; j++) {
							this.v[j] = this.memory[this.i + j];
						}
						break;
					case 0x001e:
						// ADD I, Vx fx1e set i = i + Vx
						// this.i += this.v[this.x];
						this.i = this.uint12(this.i + this.v[x]);
						break;
				}
				break;
		}
		// this.pc = this.uint12(this.pc);
	};

	loadFont = () => {
		for (let i = 0; i < this.fontSet.length; i++) {
			this.memory[i] = this.fontSet[i];
		}
	};

	pressed = () => {
		let pressed = [];
		for (let i = 0; i < this.input.length; i++) {
			if (this.input[i]) {
				pressed.push(i);
			}
		}
		return pressed;
	};

	reset = () => {
		this.delayTimer = 0;
		this.display = utils.setArray(new Array(0x800), false);
		this.input = utils.setArray(new Array(16), false);
		this.i = 0;
		this.memory = new Uint8Array(this.memBuffer);
		this.pc = 0x200;
		this.soundTimer = 0;
		this.sp = 0;
		this.stack = new Array(0x10);
		this.v = new Uint8Array(0x10);
		this.paused = 0;
		this.loadFont();
	};

	draw = (x: number, y: number, sprite: number[]) => {
		let unset = 0;
		for (let i = 0; i < sprite.length; i++) {
			let val = sprite[i];
			unset |= this.setPixel(
				this.uint8(x + 0),
				this.uint8(y + i),
				(val & 0x80) > 0
			);
			unset |= this.setPixel(
				this.uint8(x + 1),
				this.uint8(y + i),
				(val & 0x40) > 0
			);
			unset |= this.setPixel(
				this.uint8(x + 2),
				this.uint8(y + i),
				(val & 0x20) > 0
			);
			unset |= this.setPixel(
				this.uint8(x + 3),
				this.uint8(y + i),
				(val & 0x10) > 0
			);
			unset |= this.setPixel(
				this.uint8(x + 4),
				this.uint8(y + i),
				(val & 0x08) > 0
			);
			unset |= this.setPixel(
				this.uint8(x + 5),
				this.uint8(y + i),
				(val & 0x04) > 0
			);
			unset |= this.setPixel(
				this.uint8(x + 6),
				this.uint8(y + i),
				(val & 0x02) > 0
			);
			unset |= this.setPixel(
				this.uint8(x + 7),
				this.uint8(y + i),
				(val & 0x01) > 0
			);
		}
		return unset ? 1 : 0;
	};

	setPixel = (x: number, y: number, state: boolean[]) => {
		let width = this.displayWidth;
		let height = this.displayHeight;

		// wrap pixel around if it leaves border of screen;
		if (x >= width || x < 0 || y >= height || y < 0) {
			return;
		}

		let index = x + y * width;
		let original = this.display[index];
		this.display[index] = original ^ state ? true : false;
		// this is probably wrong
		return original && !this.display[index];
	};
}
