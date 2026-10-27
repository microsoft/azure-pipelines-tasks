/*
 * Dedup64K / Dedup1024K content defined chunking, ported from the managed chunker of Microsoft's MIT licensed BuildXL
 * (RegressionChunking.cs, DeterministicChunker.cs, ChunkerConfiguration.cs). The deterministic wrapper chunks fixed size
 * look-ahead windows and distrusts the last chunk of a window, so the result does not depend on how the input was read.
 */

import { chunkIdOf } from './hashing';

export type DedupHashType = 'Dedup64K' | 'Dedup1024K';

export interface ChunkerConfig {
    readonly hashType: DedupHashType;
    readonly minChunk: number;
    readonly avgChunk: number;
    readonly maxChunk: number;
    readonly windowSize: number;
}

function createConfig(hashType: DedupHashType, avgChunk: number): ChunkerConfig {
    const maxChunk = avgChunk * 2;
    return {
        hashType,
        minChunk: avgChunk / 2,
        avgChunk,
        maxChunk,
        windowSize: Math.max(1024 * 1024, 2 * maxChunk)
    };
}

export const DEDUP_64K = createConfig('Dedup64K', 64 * 1024);
export const DEDUP_1024K = createConfig('Dedup1024K', 1024 * 1024);

export function getChunkerConfig(hashType: DedupHashType): ChunkerConfig {
    switch (hashType) {
        case 'Dedup64K': return DEDUP_64K;
        case 'Dedup1024K': return DEDUP_1024K;
        default: throw new Error(`Unsupported dedup hash type '${hashType}'.`);
    }
}

export function parseHashType(value: string | undefined | null): DedupHashType | undefined {
    switch ((value ?? '').trim().toUpperCase()) {
        case 'DEDUP64K':
        case 'DEDUPNODEORCHUNK': // legacy moniker of Dedup64K
            return 'Dedup64K';
        case 'DEDUP1024K':
            return 'Dedup1024K';
        default:
            return undefined;
    }
}

export function serializeHashType(hashType: DedupHashType): string {
    return hashType === 'Dedup1024K' ? 'DEDUP1024K' : 'DEDUPNODEORCHUNK';
}

const WINDOW_BYTES = 16;
const POLYNOMIAL = 0xF2B5D42C384A2167n;
const MASK64 = (1n << 64n) - 1n;

const DOWN_HI = new Int32Array(256);
const DOWN_LO = new Int32Array(256);
const UP_HI = new Int32Array(256);
const UP_LO = new Int32Array(256);

(function buildTables(): void {
    const down: bigint[] = [];
    for (let byte = 0; byte < 256; byte++) {
        let value = BigInt(byte) << 56n;
        for (let bit = 0; bit < 8; bit++) {
            value = ((value << 1n) ^ ((value >> 63n) !== 0n ? POLYNOMIAL : 0n)) & MASK64;
        }
        down.push(value);
    }

    for (let byte = 0; byte < 256; byte++) {
        let value = BigInt(byte);
        for (let step = 0; step < WINDOW_BYTES - 1; step++) {
            value = ((value << 8n) & MASK64) ^ down[Number(value >> 56n)];
        }
        UP_HI[byte] = Number(value >> 32n) | 0;
        UP_LO[byte] = Number(value & 0xFFFFFFFFn) | 0;
        DOWN_HI[byte] = Number(down[byte] >> 32n) | 0;
        DOWN_LO[byte] = Number(down[byte] & 0xFFFFFFFFn) | 0;
    }
})();

interface Masks {
    readonly smallMask: number;
    readonly smallMatch: number;
    readonly regressMask: readonly [number, number, number, number];
    readonly regressMatch: readonly [number, number, number, number];
}

const MASK_CACHE = new Map<number, Masks>();

function getMasks(avgChunk: number): Masks {
    let masks = MASK_CACHE.get(avgChunk);
    if (masks === undefined) {
        const mask0 = avgChunk - 1;
        const match0 = 0x55555555 & mask0;
        const regressMask: [number, number, number, number] = [mask0, mask0 >>> 1, mask0 >>> 2, mask0 >>> 3];
        const regressMatch: [number, number, number, number] = [
            match0 & regressMask[0], match0 & regressMask[1], match0 & regressMask[2], match0 & regressMask[3]
        ];
        const smallMask = mask0 >>> 4;
        masks = { smallMask, smallMatch: match0 & smallMask, regressMask, regressMatch };
        MASK_CACHE.set(avgChunk, masks);
    }
    return masks;
}

function isAllZero(data: Uint8Array, from: number, to: number): boolean {
    for (let i = from; i < to; i++) {
        if (data[i] !== 0) {
            return false;
        }
    }
    return true;
}

/**
 * Returns the end offsets of the chunks of one independent look-ahead window. The final boundary is
 * always `length`; when more data follows, that last chunk may still change and must not be trusted.
 */
export function chunkBoundaries(data: Uint8Array, length: number, config: ChunkerConfig): number[] {
    const minChunk = config.minChunk;
    const maxChunk = config.maxChunk;
    const { smallMask, smallMatch, regressMask, regressMatch } = getMasks(config.avgChunk);
    const downHi = DOWN_HI;
    const downLo = DOWN_LO;
    const upHi = UP_HI;
    const upLo = UP_LO;

    const result: number[] = [];
    let start = 0;
    let zeroRun = true;

    while (start < length) {
        if (length - start < minChunk) {
            result.push(length);
            break;
        }

        let pos = start + minChunk;
        let end = Math.min(length, start + maxChunk);

        if (zeroRun && isAllZero(data, start, pos)) {
            while (pos < end && data[pos] === 0) {
                pos++;
            }
            result.push(pos);
            start = pos;
            zeroRun = true;
            continue;
        }
        zeroRun = false;

        let hi = 0;
        let lo = 0;
        for (let i = pos - WINDOW_BYTES; i < pos; i++) {
            const top = hi >>> 24;
            hi = ((hi << 8) | (lo >>> 24)) ^ downHi[top];
            lo = (lo << 8) ^ data[i] ^ downLo[top];
        }

        let regress0 = -1;
        let regress1 = -1;
        let regress2 = -1;
        let regress3 = -1;

        for (;;) {
            while (pos < end && (lo & smallMask) !== smallMatch) {
                const outgoing = data[pos - WINDOW_BYTES];
                hi ^= upHi[outgoing];
                lo ^= upLo[outgoing];
                const top = hi >>> 24;
                hi = ((hi << 8) | (lo >>> 24)) ^ downHi[top];
                lo = (lo << 8) ^ data[pos] ^ downLo[top];
                pos++;
            }

            if ((lo & smallMask) === smallMatch) {
                let index = 3;
                while (index >= 0) {
                    switch (index) {
                        case 3: regress3 = pos; break;
                        case 2: regress2 = pos; break;
                        case 1: regress1 = pos; break;
                        default: regress0 = pos; break;
                    }
                    if ((lo & regressMask[index]) !== regressMatch[index]) {
                        break;
                    }
                    index--;
                }

                if (index === -1) {
                    result.push(pos);
                    start = pos;
                    zeroRun = true;
                    break;
                }

                if (pos < end) {
                    const outgoing = data[pos - WINDOW_BYTES];
                    hi ^= upHi[outgoing];
                    lo ^= upLo[outgoing];
                    const top = hi >>> 24;
                    hi = ((hi << 8) | (lo >>> 24)) ^ downHi[top];
                    lo = (lo << 8) ^ data[pos] ^ downLo[top];
                    pos++;
                    continue;
                }
            }

            if (pos - start === maxChunk) {
                const cut = regress0 >= 0 ? regress0 : regress1 >= 0 ? regress1 : regress2 >= 0 ? regress2 : regress3 >= 0 ? regress3 : pos;
                result.push(cut);
                start = cut;
                const floor = start + minChunk;
                regress0 = regress0 >= floor ? regress0 : -1;
                regress1 = regress1 >= floor ? regress1 : -1;
                regress2 = regress2 >= floor ? regress2 : -1;
                regress3 = regress3 >= floor ? regress3 : -1;
                if (pos - start >= minChunk) {
                    end = Math.min(length, start + maxChunk);
                    continue;
                }
                zeroRun = pos - start < WINDOW_BYTES && isAllZero(data, start, pos);
                break;
            }

            result.push(length);
            return result;
        }
    }

    return result;
}

export interface ChunkInfo {
    offset: number;
    size: number;
    id: string;
}

export interface ByteSource {
    read(buffer: Buffer, offset: number, length: number, position?: number | null): Promise<{ bytesRead: number }>;
}

/**
 * Chunks a byte source with bounded memory (one look-ahead window). `onChunk` receives a view of the
 * chunk bytes that is only valid until the callback returns.
 */
export async function chunkSource(
    source: ByteSource,
    config: ChunkerConfig,
    onChunk: (chunk: ChunkInfo, data: Buffer) => void | Promise<void>
): Promise<number> {
    const window = Buffer.allocUnsafe(config.windowSize);
    let filled = 0;
    let consumed = 0;
    let eof = false;

    for (;;) {
        while (!eof && filled < window.length) {
            const { bytesRead } = await source.read(window, filled, window.length - filled, consumed + filled);
            if (bytesRead === 0) {
                eof = true;
            } else {
                filled += bytesRead;
            }
        }

        if (filled === 0) {
            return consumed;
        }

        const cuts = chunkBoundaries(window, filled, config);
        const trusted = eof ? cuts : cuts.slice(0, cuts.length - 1);
        let start = 0;
        for (const end of trusted) {
            const data = window.subarray(start, end);
            await onChunk({ offset: consumed + start, size: end - start, id: chunkIdOf(data) }, data);
            start = end;
        }

        if (eof) {
            return consumed + filled;
        }

        window.copyWithin(0, start, filled);
        filled -= start;
        consumed += start;
    }
}

export function chunkBuffer(data: Uint8Array, config: ChunkerConfig): ChunkInfo[] {
    const chunks: ChunkInfo[] = [];
    const view = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;
    while (offset < view.length) {
        const windowLength = Math.min(config.windowSize, view.length - offset);
        const window = view.subarray(offset, offset + windowLength);
        const cuts = chunkBoundaries(window, windowLength, config);
        const lastWindow = offset + windowLength >= view.length;
        const trusted = lastWindow ? cuts : cuts.slice(0, cuts.length - 1);
        let start = 0;
        for (const end of trusted) {
            chunks.push({ offset: offset + start, size: end - start, id: chunkIdOf(window.subarray(start, end)) });
            start = end;
        }
        if (lastWindow) {
            break;
        }
        offset += start;
    }
    return chunks;
}
