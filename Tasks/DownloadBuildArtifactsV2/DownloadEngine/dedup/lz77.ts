// Decoder for the LZ77 variant (MS-XCA "Plain LZ77") that the blob store uses for compressed chunks, ported from the decoder in
// azure-devops-rust-api (as ported to Python by cataggar/az-artifacts).
//
// It is a single function with its state in local variables: there is an operation for every few bytes of text, so a method call
// or a property access per operation is too slow.

import { IntegrityError, ProtocolError } from '../errors';

// Below these lengths the loop is faster than a call to a native copy or fill.
const MEMMOVE_MIN_LENGTH = 32;
const FILL_MIN_LENGTH = 16;

function grown(output: Buffer, length: number, needed: number, limit: number): Buffer {
    const larger = Buffer.allocUnsafe(Math.min(limit, Math.max(output.length * 2, needed)));
    output.copy(larger, 0, 0, length);
    return larger;
}

function decode(data: Buffer, limit: number, expectedSize: number | undefined): Buffer {
    const dataLength = data.length;
    let output: Buffer = Buffer.allocUnsafe(Math.max(16, expectedSize ?? Math.min(limit, dataLength * 4)));
    let outputEnd = Math.min(limit, output.length);
    let outputLength = 0;
    let pos = 4;
    // The position of the byte of which the high half still holds the length of a later match, or -1.
    let nibblePos = -1;

    // The flags: 32 bits per word, the most significant first, 1 for a match and 0 for a literal. The indicator holds
    // the flags that are left, shifted to the top, and a one bit behind them: the word is used up when it becomes 0.
    let raw = (data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24)) >>> 0;
    let indicator = ((raw << 1) + 1) | 0;
    let freshLiteral = raw < 0x80000000;
    let matchNow = !freshLiteral;
    if (matchNow && pos + 1 >= dataLength) {
        return output.subarray(0, 0);
    }

    for (;;) {
        if (!matchNow) {
            if (pos >= dataLength) {
                break;
            }
            let literal = true;
            if (freshLiteral) {
                freshLiteral = false;
            } else if (indicator >= 0) {
                indicator = (indicator << 1) | 0;
            } else {
                literal = false;
            }

            if (literal) {
                // A run of literals: this one, and as many as the flags say follow it.
                for (;;) {
                    if (outputLength >= outputEnd) {
                        if (outputLength + 1 > limit) {
                            throw new IntegrityError('Decompressed chunk exceeds its size limit.');
                        }
                        output = grown(output, outputLength, outputLength + 1, limit);
                        outputEnd = Math.min(limit, output.length);
                    }
                    if (pos >= dataLength) {
                        throw new ProtocolError('Truncated literal in compressed chunk.');
                    }
                    output[outputLength++] = data[pos++];
                    if (indicator < 0) {
                        break;
                    }
                    indicator = (indicator << 1) | 0;
                }
            }

            // The next item is a match: take its flag, and the next word of flags when this one is used up.
            indicator = (indicator << 1) | 0;
            if (indicator === 0) {
                if (pos + 3 >= dataLength) {
                    break;
                }
                raw = (data[pos] | (data[pos + 1] << 8) | (data[pos + 2] << 16) | (data[pos + 3] << 24)) >>> 0;
                pos += 4;
                indicator = ((raw << 1) + 1) | 0;
                if (raw < 0x80000000) {
                    freshLiteral = true;
                    continue;
                }
            }
            if (pos + 1 >= dataLength) {
                break;
            }
        }
        matchNow = false;

        if (pos + 2 > dataLength) {
            throw new ProtocolError('Truncated compressed chunk.');
        }
        const value = data[pos] | (data[pos + 1] << 8);
        pos += 2;
        let length = value & 7;
        const offset = (value >> 3) + 1;
        if (length === 7) {
            if (nibblePos < 0) {
                nibblePos = pos;
                if (pos + 1 > dataLength) {
                    throw new ProtocolError('Truncated compressed chunk.');
                }
                length = data[pos++] & 0x0f;
            } else {
                length = data[nibblePos] >> 4;
                nibblePos = -1;
            }
            if (length === 15) {
                if (pos + 1 > dataLength) {
                    throw new ProtocolError('Truncated compressed chunk.');
                }
                length = data[pos++];
                if (length === 255) {
                    if (pos + 2 > dataLength) {
                        throw new ProtocolError('Truncated compressed chunk.');
                    }
                    length = data[pos] | (data[pos + 1] << 8);
                    pos += 2;
                    if (length === 0) {
                        if (pos + 4 > dataLength) {
                            throw new ProtocolError('Truncated compressed chunk.');
                        }
                        length = (data[pos] | (data[pos + 1] << 8) | (data[pos + 2] << 16) | (data[pos + 3] << 24)) >>> 0;
                        pos += 4;
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

        if (offset > outputLength) {
            throw new ProtocolError('Compressed match refers outside the output history.');
        }
        if (outputLength + length > outputEnd) {
            if (outputLength + length > limit) {
                throw new IntegrityError('Decompressed chunk exceeds its size limit.');
            }
            output = grown(output, outputLength, outputLength + length, limit);
            outputEnd = Math.min(limit, output.length);
        }
        const from = outputLength - offset;
        if (offset >= length && length >= MEMMOVE_MIN_LENGTH) {
            output.copyWithin(outputLength, from, from + length);
        } else if (offset === 1 && length >= FILL_MIN_LENGTH) {
            output.fill(output[from], outputLength, outputLength + length);
        } else {
            // A match that overlaps its own output repeats a pattern, which only a byte by byte copy produces.
            for (let i = 0; i < length; i++) {
                output[outputLength + i] = output[from + i];
            }
        }
        outputLength += length;
    }
    return output.subarray(0, outputLength);
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
    const output = decode(compressed, limit, expectedSize);
    if (expectedSize !== undefined && output.length !== expectedSize) {
        throw new IntegrityError('Decompressed chunk does not match its advertised size.');
    }
    return output;
}
