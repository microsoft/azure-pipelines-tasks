/** A compressor for tests: it writes the LZ77 variant (MS-XCA "Plain LZ77") from a list of literal bytes and matches. */
export type Lz77Op = { literal: Buffer } | { offset: number; length: number };

export function encodeLz77(ops: readonly Lz77Op[]): Buffer {
    const out: number[] = [];
    let flags = 0;
    let flagCount = 0;
    let flagPosition = -1;
    let nibblePosition = -1;

    const writeFlags = (position: number, value: number) => {
        out[position] = value & 0xff;
        out[position + 1] = (value >>> 8) & 0xff;
        out[position + 2] = (value >>> 16) & 0xff;
        out[position + 3] = (value >>> 24) & 0xff;
    };

    const item = (bit: 0 | 1) => {
        if (flagPosition < 0) {
            flagPosition = out.length;
            out.push(0, 0, 0, 0);
        }
        flags = ((flags << 1) | bit) >>> 0;
        if (++flagCount === 32) {
            writeFlags(flagPosition, flags);
            flags = 0;
            flagCount = 0;
            flagPosition = -1;
        }
    };

    for (const op of ops) {
        if ('literal' in op) {
            for (const byte of op.literal) {
                item(0);
                out.push(byte);
            }
            continue;
        }

        if (op.length < 3 || op.offset < 1 || op.offset > 8192) {
            throw new Error('A match has a length of at least 3 and an offset of 1 through 8192.');
        }
        item(1);
        const length = op.length - 3;
        const head = (op.offset - 1) << 3;
        if (length < 7) {
            out.push((head | length) & 0xff, ((head | length) >>> 8) & 0xff);
            continue;
        }
        out.push((head | 7) & 0xff, ((head | 7) >>> 8) & 0xff);
        const extra = length - 7;
        const nibble = Math.min(extra, 15);
        if (nibblePosition < 0) {
            nibblePosition = out.length;
            out.push(nibble);
        } else {
            out[nibblePosition] |= nibble << 4;
            nibblePosition = -1;
        }
        if (extra >= 15) {
            const rest = extra - 15;
            if (rest < 255) {
                out.push(rest);
            } else {
                out.push(255);
                const wide = rest + 22;
                if (wide < 0x10000) {
                    out.push(wide & 0xff, wide >>> 8);
                } else {
                    out.push(0, 0, wide & 0xff, (wide >>> 8) & 0xff, (wide >>> 16) & 0xff, (wide >>> 24) & 0xff);
                }
            }
        }
    }

    if (flagCount > 0) {
        writeFlags(flagPosition, ((flags << (32 - flagCount)) | ((1 << (32 - flagCount)) - 1)) >>> 0);
    }
    return Buffer.from(out);
}

export function expandLz77(ops: readonly Lz77Op[]): Buffer {
    const out: number[] = [];
    for (const op of ops) {
        if ('literal' in op) {
            out.push(...op.literal);
        } else {
            for (let i = 0; i < op.length; i++) {
                out.push(out[out.length - op.offset]);
            }
        }
    }
    return Buffer.from(out);
}

function next(state: { value: number }): number {
    state.value ^= state.value << 13; state.value >>>= 0;
    state.value ^= state.value >>> 17;
    state.value ^= state.value << 5; state.value >>>= 0;
    return state.value / 4294967296;
}

/** A random program: some literals, then matches with small, large and overlapping offsets and short, long and very long lengths. */
export function randomLz77Program(seed: number, operations: number): Lz77Op[] {
    const state = { value: seed >>> 0 || 1 };
    const ops: Lz77Op[] = [];
    let produced = 0;
    const literal = (count: number) => {
        const bytes = Buffer.alloc(count);
        for (let i = 0; i < count; i++) {
            bytes[i] = Math.floor(next(state) * 256);
        }
        ops.push({ literal: bytes });
        produced += count;
    };
    literal(1 + Math.floor(next(state) * 6));
    for (let i = 0; i < operations; i++) {
        if (next(state) < 0.25) {
            literal(1 + Math.floor(next(state) * 9));
            continue;
        }
        const kind = next(state);
        const offset = Math.max(1, Math.min(produced, 8192, kind < 0.3 ? 1 + Math.floor(next(state) * 8) : 1 + Math.floor(next(state) * 8192)));
        const size = next(state);
        const length = size < 0.5 ? 3 + Math.floor(next(state) * 10)
            : size < 0.8 ? 13 + Math.floor(next(state) * 100)
                : size < 0.97 ? 113 + Math.floor(next(state) * 600)
                    : 700 + Math.floor(next(state) * 90000);
        ops.push({ offset, length });
        produced += length;
    }
    return ops;
}
