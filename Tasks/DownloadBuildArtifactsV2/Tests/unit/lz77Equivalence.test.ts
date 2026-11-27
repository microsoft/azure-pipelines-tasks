import * as assert from 'assert';
import { decompressChunk } from '../../DownloadEngine/dedup/lz77';
import { encodeLz77, expandLz77, randomLz77Program } from './lz77Encoder';
import { referenceDecompressChunk } from './lz77Reference';
import { readFixtureJson } from './testUtil';

type Outcome = { value: Buffer } | { error: string };

function outcomeOf(decode: typeof decompressChunk, input: Buffer, options: { maxOutputSize?: number; expectedSize?: number }): Outcome {
    try {
        return { value: Buffer.from(decode(input, options)) };
    } catch (error) {
        return { error: `${(error as Error).constructor.name}: ${(error as Error).message}` };
    }
}

function assertSameOutcome(input: Buffer, options: { maxOutputSize?: number; expectedSize?: number }): void {
    const expected = outcomeOf(referenceDecompressChunk, input, options);
    const actual = outcomeOf(decompressChunk, input, options);
    if ('value' in expected) {
        assert.ok('value' in actual, `the decoders disagree: the reference decoded ${expected.value.length} bytes, the decoder failed with ${(actual as { error: string }).error}`);
        assert.ok(expected.value.equals((actual as { value: Buffer }).value), 'the decoders produced different output');
    } else {
        assert.deepStrictEqual(actual, expected);
    }
}

function random(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state ^= state << 13; state >>>= 0;
        state ^= state >>> 17;
        state ^= state << 5; state >>>= 0;
        return state / 4294967296;
    };
}

// The decoder copies matches and literals with native calls where that is faster. Whatever a stream holds, valid or
// damaged, it has to do exactly what the byte by byte reference decoder does.
describe('LZ77 decoder equivalence with the reference decoder', function () {
    this.timeout(120000);

    const samples = readFixtureJson<Array<{ id: string; size: number; compressedBase64: string }>>('lz77-real-samples.json')
        .map(sample => ({ size: sample.size, data: Buffer.from(sample.compressedBase64, 'base64') }));

    it('decodes the real chunks like the reference decoder', () => {
        for (const sample of samples) {
            assertSameOutcome(sample.data, { expectedSize: sample.size });
            assertSameOutcome(sample.data, {});
            assertSameOutcome(sample.data, { expectedSize: sample.size, maxOutputSize: sample.size });
        }
    });

    it('fails like the reference decoder when the size or the limit does not fit', () => {
        for (const sample of samples) {
            for (const expectedSize of [0, 1, sample.size - 1, sample.size + 1, sample.size * 2]) {
                assertSameOutcome(sample.data, { expectedSize });
            }
            for (const maxOutputSize of [0, 1, 100, sample.size - 1]) {
                assertSameOutcome(sample.data, { maxOutputSize });
            }
        }
    });

    it('behaves like the reference decoder for damaged real chunks', () => {
        const next = random(20240601);
        for (const sample of samples) {
            for (let round = 0; round < 1500; round++) {
                const damaged = Buffer.from(sample.data);
                const edits = 1 + Math.floor(next() * 4);
                for (let edit = 0; edit < edits; edit++) {
                    damaged[Math.floor(next() * damaged.length)] = Math.floor(next() * 256);
                }
                const kind = next();
                const input = kind < 0.2 ? damaged.subarray(0, Math.max(5, Math.floor(next() * damaged.length)))
                    : kind < 0.3 ? Buffer.concat([damaged, Buffer.from([Math.floor(next() * 256), Math.floor(next() * 256)])])
                        : damaged;
                assertSameOutcome(input, { expectedSize: next() < 0.5 ? sample.size : undefined });
            }
        }
    });

    it('behaves like the reference decoder for random byte streams', () => {
        const next = random(987654321);
        for (let round = 0; round < 6000; round++) {
            const length = 5 + Math.floor(next() * 120);
            const input = Buffer.alloc(length);
            for (let index = 0; index < length; index++) {
                // Many zero bytes make long flag words and small offsets, which exercises overlapping matches.
                input[index] = next() < 0.4 ? 0 : Math.floor(next() * 256);
            }
            assertSameOutcome(input, { expectedSize: next() < 0.3 ? Math.floor(next() * 2000) : undefined });
        }
    });

    it('decodes valid programs of literals and matches, with overlapping and very long matches, to what they describe', () => {
        for (let seed = 1; seed <= 400; seed++) {
            const ops = randomLz77Program(seed, 1 + (seed % 60));
            const expected = expandLz77(ops);
            const encoded = encodeLz77(ops);
            for (const decode of [decompressChunk, referenceDecompressChunk]) {
                const decoded = decode(encoded, { expectedSize: expected.length, maxOutputSize: expected.length });
                assert.ok(decoded.equals(expected), `program ${seed} was not decoded to its output`);
            }
        }
    });

    it('behaves like the reference decoder for damaged valid programs', () => {
        const next = random(55555);
        for (let seed = 1; seed <= 300; seed++) {
            const ops = randomLz77Program(seed + 1000, 1 + (seed % 40));
            const encoded = encodeLz77(ops);
            const size = expandLz77(ops).length;
            for (let round = 0; round < 6; round++) {
                const damaged = Buffer.from(encoded);
                damaged[Math.floor(next() * damaged.length)] = Math.floor(next() * 256);
                const input = next() < 0.3 ? damaged.subarray(0, Math.max(5, Math.floor(next() * damaged.length))) : damaged;
                assertSameOutcome(input, { expectedSize: next() < 0.5 ? size : undefined });
            }
        }
    });
});
