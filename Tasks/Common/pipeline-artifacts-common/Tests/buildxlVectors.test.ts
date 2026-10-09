import * as assert from 'assert';
import { chunkBuffer, DEDUP_1024K, DEDUP_64K, ChunkerConfig } from '../src/dedup/chunker';
import { EMPTY_CHUNK_ID } from '../src/dedup/hashing';
import { NodeBuilder } from '../src/dedup/nodes';
import { readFixtureJson } from './testUtil';

/** Port of the legacy (seeded) System.Random of .NET, which BuildXL's test data generator uses. */
class DotNetRandom {
    private readonly seedArray = new Int32Array(56);
    private inext = 0;
    private inextp = 21;

    constructor(seed: number) {
        const subtraction = seed === -2147483648 ? 2147483647 : Math.abs(seed);
        let mj = 161803398 - subtraction;
        this.seedArray[55] = mj;
        let mk = 1;
        let ii = 0;
        for (let i = 1; i < 55; i++) {
            ii += 21;
            if (ii >= 55) {
                ii -= 55;
            }
            this.seedArray[ii] = mk;
            mk = mj - mk;
            if (mk < 0) {
                mk += 2147483647;
            }
            mj = this.seedArray[ii];
        }
        for (let k = 1; k < 5; k++) {
            for (let i = 1; i < 56; i++) {
                let n = i + 30;
                if (n >= 55) {
                    n -= 55;
                }
                this.seedArray[i] -= this.seedArray[1 + n];
                if (this.seedArray[i] < 0) {
                    this.seedArray[i] += 2147483647;
                }
            }
        }
    }

    private internalSample(): number {
        let next = this.inext + 1;
        if (next >= 56) {
            next = 1;
        }
        let nextp = this.inextp + 1;
        if (nextp >= 56) {
            nextp = 1;
        }
        let result = this.seedArray[next] - this.seedArray[nextp];
        if (result === 2147483647) {
            result--;
        }
        if (result < 0) {
            result += 2147483647;
        }
        this.seedArray[next] = result;
        this.inext = next;
        this.inextp = nextp;
        return result;
    }

    private sample(): number {
        return this.internalSample() * (1.0 / 2147483647);
    }

    next(maxValue: number): number {
        return Math.trunc(this.sample() * maxValue);
    }

    nextRange(minValue: number, maxValue: number): number {
        return Math.trunc(this.sample() * (maxValue - minValue)) + minValue;
    }

    nextBytes(buffer: Buffer): void {
        for (let i = 0; i < buffer.length; i++) {
            buffer[i] = this.internalSample() & 0xFF;
        }
    }
}

function testContent(seed: number, length: number): Buffer {
    const bytes = Buffer.alloc(length);
    if (length === 0 || seed < 0) {
        return bytes;
    }
    const random = new DotNetRandom(seed);
    random.nextBytes(bytes);
    const startZeroes = random.next(bytes.length);
    const endZeroes = random.nextRange(startZeroes, bytes.length);
    bytes.fill(0, startZeroes, endZeroes);
    return bytes;
}

function rootHash(data: Buffer, config: ChunkerConfig): string {
    const chunks = chunkBuffer(data, config);
    if (chunks.length === 0) {
        return EMPTY_CHUNK_ID.substring(0, 64);
    }
    const root = chunks.length === 1 ? chunks[0] : new NodeBuilder().tree(chunks);
    return root.id.substring(0, 64);
}

interface Vectors {
    vectors: Record<'random64K' | 'random1024K' | 'zeros64K' | 'zeros1024K', Array<{ size: number; hash: string }>>;
}

// Known answers of BuildXL's own unit tests (DedupNodeContentHasherTests) for the managed chunker.
describe('BuildXL dedup known answers', function () {
    this.timeout(120000);
    const fixture = readFixtureJson<Vectors>('buildxl-dedup-vectors.json');

    const sets: Array<[keyof Vectors['vectors'], ChunkerConfig, number]> = [
        ['zeros64K', DEDUP_64K, -1],
        ['zeros1024K', DEDUP_1024K, -1],
        ['random64K', DEDUP_64K, 0],
        ['random1024K', DEDUP_1024K, 0]
    ];

    for (const [name, config, seed] of sets) {
        describe(name, () => {
            for (const vector of fixture.vectors[name]) {
                it(`hashes ${vector.size} bytes like BuildXL`, () => {
                    assert.strictEqual(rootHash(testContent(seed, vector.size), config), vector.hash);
                });
            }
        });
    }
});
