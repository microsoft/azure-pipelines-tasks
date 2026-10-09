// Decoder for the LZ77 variant (MS-XCA "Plain LZ77") the blob store uses for compressed chunks. It is a
// port of the decoder in azure-devops-rust-api, as ported to Python by cataggar/az-artifacts.

import { IntegrityError, ProtocolError } from '../errors';

function shift(value: number, sentinel: boolean = false): number {
    return ((value << 1) + (sentinel ? 1 : 0)) | 0;
}

class Decoder {
    private pos = 0;
    private output: Buffer;
    private outputLength = 0;
    private nibblePos: number | undefined;

    constructor(private readonly data: Buffer, private readonly limit: number, expectedSize: number | undefined) {
        this.output = Buffer.allocUnsafe(Math.max(16, expectedSize ?? Math.min(limit, data.length * 4)));
    }

    private number(count: 1 | 2 | 4): number {
        if (this.pos + count > this.data.length) {
            throw new ProtocolError('Truncated compressed chunk.');
        }
        let value: number;
        switch (count) {
            case 1: value = this.data[this.pos]; break;
            case 2: value = this.data.readUInt16LE(this.pos); break;
            default: value = this.data.readUInt32LE(this.pos); break;
        }
        this.pos += count;
        return value;
    }

    private ensure(extra: number): void {
        if (this.outputLength + extra > this.limit) {
            throw new IntegrityError('Decompressed chunk exceeds its size limit.');
        }
        if (this.outputLength + extra > this.output.length) {
            const grown = Buffer.allocUnsafe(Math.min(this.limit, Math.max(this.output.length * 2, this.outputLength + extra)));
            this.output.copy(grown, 0, 0, this.outputLength);
            this.output = grown;
        }
    }

    private literal(count: number): void {
        this.ensure(count);
        if (this.pos + count > this.data.length) {
            throw new ProtocolError('Truncated literal in compressed chunk.');
        }
        this.data.copy(this.output, this.outputLength, this.pos, this.pos + count);
        this.outputLength += count;
        this.pos += count;
    }

    private match(): void {
        const value = this.number(2);
        let length = value & 7;
        const offset = (value >> 3) + 1;
        if (length === 7) {
            if (this.nibblePos === undefined) {
                this.nibblePos = this.pos;
                length = this.number(1) & 0x0F;
            } else {
                length = this.data[this.nibblePos] >> 4;
                this.nibblePos = undefined;
            }
            if (length === 15) {
                length = this.number(1);
                if (length === 255) {
                    length = this.number(2);
                    if (length === 0) {
                        length = this.number(4);
                    }
                    if (length < 22) {
                        throw new ProtocolError('Invalid extended match length.');
                    }
                    length -= 22;
                }
                length += 15;
            }
            length += 7;
        }
        length += 3;

        if (offset > this.outputLength) {
            throw new ProtocolError('Compressed match refers outside the output history.');
        }
        this.ensure(length);
        let from = this.outputLength - offset;
        for (let i = 0; i < length; i++) {
            this.output[this.outputLength++] = this.output[from++];
        }
    }

    decode(): Buffer {
        let raw = this.number(4);
        let indicator = shift(raw, true);
        let freshLiteral = raw < 0x80000000;
        if (!freshLiteral) {
            if (this.pos + 1 >= this.data.length) {
                return this.result();
            }
            this.match();
        }

        while (this.pos < this.data.length) {
            if (freshLiteral) {
                freshLiteral = false;
            } else if (indicator >= 0) {
                indicator = shift(indicator);
            } else {
                indicator = shift(indicator);
                if (indicator === 0) {
                    if (this.pos + 3 >= this.data.length) {
                        break;
                    }
                    raw = this.number(4);
                    indicator = shift(raw, true);
                    if (raw < 0x80000000) {
                        freshLiteral = true;
                        continue;
                    }
                }
                if (this.pos + 1 >= this.data.length) {
                    break;
                }
                this.match();
                continue;
            }

            for (;;) {
                if (indicator < 0) {
                    this.literal(1);
                    break;
                }
                indicator = shift(indicator);
                if (indicator < 0) {
                    this.literal(2);
                    break;
                }
                indicator = shift(indicator);
                if (indicator < 0) {
                    this.literal(3);
                    break;
                }
                indicator = shift(indicator);
                this.literal(4);
                if (indicator < 0) {
                    break;
                }
                indicator = shift(indicator);
            }

            indicator = shift(indicator);
            if (indicator === 0) {
                if (this.pos + 3 >= this.data.length) {
                    break;
                }
                raw = this.number(4);
                indicator = shift(raw, true);
                if (raw < 0x80000000) {
                    freshLiteral = true;
                    continue;
                }
            }
            if (this.pos + 1 >= this.data.length) {
                break;
            }
            this.match();
        }
        return this.result();
    }

    private result(): Buffer {
        return this.output.subarray(0, this.outputLength);
    }
}

export function decompressChunk(compressed: Buffer, options: { maxOutputSize?: number; expectedSize?: number } = {}): Buffer {
    const maxOutputSize = options.maxOutputSize ?? 4 * 1024 * 1024;
    const expectedSize = options.expectedSize;
    if (maxOutputSize < 0 || (expectedSize !== undefined && expectedSize < 0)) {
        throw new Error('Decompression sizes cannot be negative.');
    }
    if (compressed.length < 5) {
        throw new ProtocolError('Compressed data must contain at least five bytes.');
    }

    const limit = expectedSize !== undefined ? Math.min(maxOutputSize, expectedSize) : maxOutputSize;
    const output = new Decoder(compressed, limit, expectedSize).decode();
    if (expectedSize !== undefined && output.length !== expectedSize) {
        throw new IntegrityError('Decompressed chunk does not match its advertised size.');
    }
    return output;
}
