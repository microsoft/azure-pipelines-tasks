import * as assert from 'assert';
import { decompressChunk } from '../src/dedup/lz77';
import { IntegrityError, ProtocolError } from '../src/errors';
import { chunkIdOf } from '../src/dedup/hashing';
import { readFixtureJson } from './testUtil';

function le32(value: number): Buffer {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32LE(value >>> 0);
    return buffer;
}

function bytes(...values: number[]): Buffer {
    return Buffer.from(values);
}

// The vectors mirror the ones of the az-artifacts reference implementation of the same decoder.
describe('LZ77 decompression', () => {
    it('rejects data that is too small', () => {
        assert.throws(() => decompressChunk(Buffer.alloc(0)), ProtocolError);
        assert.throws(() => decompressChunk(Buffer.alloc(4)), ProtocolError);
    });

    for (const [indicator, literal] of [[0x40000000, 'H'], [0x20000000, 'Hi'], [0x10000000, 'Hey'], [0x08000000, 'Test']] as const) {
        it(`decodes a ${literal.length} byte literal`, () => {
            assert.deepStrictEqual(decompressChunk(Buffer.concat([le32(indicator), Buffer.from(literal)])), Buffer.from(literal));
        });
    }

    it('decodes a literal followed by an overlapping match', () => {
        assert.deepStrictEqual(decompressChunk(bytes(0, 0, 0, 0x40, 0x41, 0, 0)), Buffer.from('AAAA'));
    });

    it('rejects matches outside of the history', () => {
        assert.throws(() => decompressChunk(bytes(0, 0, 0, 0x80, 0x08, 0)), (error: Error) => error instanceof ProtocolError && /history/.test(error.message));
    });

    const extended: [number[], number][] = [
        [[0x00], 10],
        [[0x0e], 24],
        [[0x0f, 0x00], 25],
        [[0x0f, 0xff, 0x16, 0x00], 25],
        [[0x0f, 0xff, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00], 25]
    ];
    for (const [extension, length] of extended) {
        it(`decodes the extended match length encoding ${Buffer.from(extension).toString('hex')}`, () => {
            const compressed = Buffer.concat([bytes(0, 0, 0, 0x40, 0x41, 0x07, 0x00), Buffer.from(extension)]);
            assert.deepStrictEqual(decompressChunk(compressed, { expectedSize: length + 1 }), Buffer.alloc(length + 1, 'A'));
        });
    }

    it('shares a length nibble between two matches', () => {
        const compressed = bytes(0, 0, 0, 0x60, 0x41, 0x07, 0x00, 0x10, 0x07, 0x00);
        assert.deepStrictEqual(decompressChunk(compressed), Buffer.alloc(22, 'A'));
    });

    for (const extension of [[], [0x0f], [0x0f, 0xff], [0x0f, 0xff, 0x15, 0x00]]) {
        it(`rejects the invalid extended match ${Buffer.from(extension).toString('hex') || '(empty)'}`, () => {
            assert.throws(() => decompressChunk(Buffer.concat([bytes(0, 0, 0, 0x40, 0x41, 0x07, 0x00), Buffer.from(extension)])), ProtocolError);
        });
    }

    it('rejects truncated literals, size mismatches and oversized output', () => {
        assert.throws(() => decompressChunk(bytes(0, 0, 0, 0x08, 0x41)), (error: Error) => error instanceof ProtocolError && /Truncated/.test(error.message));
        assert.throws(() => decompressChunk(bytes(0, 0, 0, 0x40, 0x41), { expectedSize: 2 }), IntegrityError);
        assert.throws(() => decompressChunk(bytes(0, 0, 0, 0x40, 0x41, 0, 0), { maxOutputSize: 3 }), (error: Error) => error instanceof IntegrityError && /limit/.test(error.message));
    });

    it('decodes compressed chunks as served by the real blob store', () => {
        const samples = readFixtureJson<Array<{ id: string; size: number; compressedBase64: string }>>('lz77-real-samples.json');
        assert.ok(samples.length >= 3);
        for (const sample of samples) {
            const decoded = decompressChunk(Buffer.from(sample.compressedBase64, 'base64'), { expectedSize: sample.size });
            assert.strictEqual(decoded.length, sample.size);
            assert.strictEqual(chunkIdOf(decoded), sample.id);
        }
    });
});
