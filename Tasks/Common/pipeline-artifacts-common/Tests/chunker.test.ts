import * as assert from 'assert';
import * as crypto from 'crypto';
import { chunkBoundaries, chunkBuffer, chunkSource, ChunkInfo, DEDUP_1024K, DEDUP_64K, getChunkerConfig, parseHashType, serializeHashType } from '../src/dedup/chunker';
import { EMPTY_CHUNK_ID } from '../src/dedup/hashing';
import { NodeBuilder } from '../src/dedup/nodes';
import { readFixtureJson, seeded, shortReadSource } from './testUtil';

interface Vector {
    name: string;
    recipe: { kind: 'zeros' | 'seeded'; length: number }[];
    sha256: string;
    root: string;
    chunks: { id: string; size: number }[];
}

const fixture = readFixtureJson<{ seed: string; vectors: Vector[] }>('sdk-chunk-vectors.json');

function buildData(vector: Vector): Buffer {
    return Buffer.concat(vector.recipe.map(part => part.kind === 'zeros' ? Buffer.alloc(part.length) : seeded(fixture.seed, part.length)));
}

function rootOf(chunks: { id: string; size: number }[]): string {
    if (chunks.length === 0) {
        return EMPTY_CHUNK_ID;
    }
    return chunks.length === 1 ? chunks[0].id : new NodeBuilder().tree(chunks).id;
}

async function collect(source: ReturnType<typeof shortReadSource>): Promise<ChunkInfo[]> {
    const chunks: ChunkInfo[] = [];
    await chunkSource(source, DEDUP_64K, chunk => { chunks.push(chunk); });
    return chunks;
}

describe('Dedup64K chunker', () => {
    for (const vector of fixture.vectors) {
        it(`matches the ArtifactTool SDK vector ${vector.name}`, async () => {
            const data = buildData(vector);
            assert.strictEqual(crypto.createHash('sha256').update(data).digest('hex'), vector.sha256);

            const expected = vector.chunks.map(chunk => ({ id: chunk.id, size: chunk.size }));
            const inMemory = chunkBuffer(data, DEDUP_64K).map(chunk => ({ id: chunk.id, size: chunk.size }));
            assert.deepStrictEqual(inMemory.length === 0 ? [{ id: EMPTY_CHUNK_ID, size: 0 }] : inMemory, expected);
            assert.strictEqual(rootOf(expected), vector.root);

            for (const maxRead of [data.length + 1, 997, 1 << 20]) {
                const streamed = (await collect(shortReadSource(data, maxRead))).map(chunk => ({ id: chunk.id, size: chunk.size }));
                assert.deepStrictEqual(streamed.length === 0 ? [{ id: EMPTY_CHUNK_ID, size: 0 }] : streamed, expected, `maxRead=${maxRead}`);
            }
        });
    }
});

describe('chunker invariants', () => {
    for (const config of [DEDUP_64K, DEDUP_1024K]) {
        describe(config.hashType, () => {
            it('keeps every chunk but the last within the minimum and maximum size', () => {
                const data = seeded('invariants', 12 * config.windowSize + 12345);
                const chunks = chunkBuffer(data, config);
                assert.strictEqual(chunks.reduce((sum, chunk) => sum + chunk.size, 0), data.length);
                chunks.forEach((chunk, index) => {
                    assert.ok(chunk.size <= config.maxChunk, `chunk ${index} too large: ${chunk.size}`);
                    if (index < chunks.length - 1) {
                        assert.ok(chunk.size >= config.minChunk, `chunk ${index} too small: ${chunk.size}`);
                    }
                });
            });

            it('does not depend on how the input is read', async () => {
                const data = Buffer.concat([seeded('a', 3 * config.windowSize + 7), Buffer.alloc(config.maxChunk + 5), seeded('b', config.windowSize / 2)]);
                const expected = chunkBuffer(data, config).map(chunk => chunk.id);
                for (const maxRead of [1, 4093, config.windowSize - 1, config.windowSize, 5 * config.windowSize]) {
                    const ids: string[] = [];
                    await chunkSource(shortReadSource(data, maxRead), config, chunk => { ids.push(chunk.id); });
                    assert.deepStrictEqual(ids, expected, `maxRead=${maxRead}`);
                }
            });

            it('cuts zero runs independently of content', () => {
                const data = Buffer.concat([seeded('z', config.minChunk), Buffer.alloc(3 * config.maxChunk), seeded('y', config.minChunk)]);
                const chunks = chunkBuffer(data, config);
                assert.strictEqual(chunks.reduce((sum, chunk) => sum + chunk.size, 0), data.length);
                assert.ok(chunks.length >= 3);
            });

            it('chunks a single minimum sized input as one chunk', () => {
                for (const length of [1, config.minChunk - 1, config.minChunk]) {
                    const boundaries = chunkBoundaries(seeded('m', length), length, config);
                    assert.deepStrictEqual(boundaries, [length]);
                }
            });
        });
    }

    it('uses the chunk sizes of the two dedup variants', () => {
        assert.deepStrictEqual([DEDUP_64K.minChunk, DEDUP_64K.avgChunk, DEDUP_64K.maxChunk, DEDUP_64K.windowSize], [32768, 65536, 131072, 1048576]);
        assert.deepStrictEqual([DEDUP_1024K.minChunk, DEDUP_1024K.avgChunk, DEDUP_1024K.maxChunk, DEDUP_1024K.windowSize], [524288, 1048576, 2097152, 4194304]);
    });

    it('maps hash type names', () => {
        assert.strictEqual(parseHashType('Dedup1024k'), 'Dedup1024K');
        assert.strictEqual(parseHashType('DEDUP1024K'), 'Dedup1024K');
        assert.strictEqual(parseHashType('DedupNodeOrChunk'), 'Dedup64K');
        assert.strictEqual(parseHashType('dedup64k'), 'Dedup64K');
        assert.strictEqual(parseHashType('nonsense'), undefined);
        assert.strictEqual(serializeHashType('Dedup1024K'), 'DEDUP1024K');
        assert.strictEqual(getChunkerConfig('Dedup64K'), DEDUP_64K);
    });
});
