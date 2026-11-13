import * as assert from 'assert';
import { decodeBlob } from '../../DownloadEngine/dedup/blobCodec';
import { IntegrityError, ProtocolError } from '../../DownloadEngine/errors';
import { chunkIdOf, isNodeId, nodeIdOf } from '../../DownloadEngine/dedup/hashing';
import { decompressChunk } from '../../DownloadEngine/dedup/lz77';
import { encodeLz77, expandLz77, randomLz77Program } from './lz77Encoder';

// Reference: hashes the blob as served first, whatever its size, and decompresses only as the fallback.
function referenceDecode(data: Buffer, id: string, size: number | undefined, limit: number): Buffer {
    if (size !== undefined && size > limit) {
        throw new ProtocolError('The advertised blob size exceeds the supported limit.');
    }
    const hashOf = isNodeId(id) ? nodeIdOf : chunkIdOf;
    if (data.length <= limit && hashOf(data) === id) {
        if (size !== undefined && data.length !== size) {
            throw new IntegrityError('A blob does not match its advertised size.');
        }
        return data;
    }
    let decoded: Buffer;
    try {
        decoded = decompressChunk(data, { maxOutputSize: limit, expectedSize: size });
    } catch (error) {
        throw new IntegrityError(`A blob is neither valid raw data nor supported compressed content: ${(error as Error).message}`);
    }
    if (hashOf(decoded) !== id) {
        throw new IntegrityError('A blob does not match its content identifier.');
    }
    return decoded;
}

type Outcome = { value: string } | { error: string };

function outcomeOf(decode: typeof decodeBlob, data: Buffer, id: string, size: number | undefined, limit: number): Outcome {
    try {
        return { value: decode(Buffer.from(data), id, size, limit).toString('hex') };
    } catch (error) {
        return { error: `${(error as Error).constructor.name}: ${(error as Error).message}` };
    }
}

function program(seed: number) {
    const ops = randomLz77Program(seed, 20);
    const content = expandLz77(ops);
    return { content, compressed: encodeLz77(ops), id: chunkIdOf(content) };
}

describe('decodeBlob', () => {
    const limit = 4 * 1024 * 1024;

    it('returns a blob that is stored as it is', () => {
        const data = Buffer.from('plain chunk content');
        assert.deepStrictEqual(decodeBlob(data, chunkIdOf(data), data.length, limit), data);
        assert.deepStrictEqual(decodeBlob(data, chunkIdOf(data), undefined, limit), data);
    });

    it('decompresses a blob that is stored compressed, with or without a known size', () => {
        const { content, compressed, id } = program(7);
        assert.ok(compressed.length < content.length);
        assert.deepStrictEqual(decodeBlob(compressed, id, content.length, limit), content);
        assert.deepStrictEqual(decodeBlob(compressed, id, undefined, limit), content);
    });

    it('decodes nodes like chunks', () => {
        const node = Buffer.from('a node is a list of children');
        assert.deepStrictEqual(decodeBlob(node, nodeIdOf(node), undefined, limit), node);
        assert.throws(() => decodeBlob(node, nodeIdOf(Buffer.from('another node')), undefined, limit), IntegrityError);
    });

    it('rejects a blob of the wrong size, the wrong content and a size above the limit', () => {
        const data = Buffer.from('chunk');
        const id = chunkIdOf(data);
        assert.throws(() => decodeBlob(data, id, data.length + 1, limit), (error: Error) => error instanceof IntegrityError && /advertised size/.test(error.message));
        assert.throws(() => decodeBlob(data, id, data.length - 1, limit), (error: Error) => error instanceof IntegrityError && /advertised size/.test(error.message));
        assert.throws(() => decodeBlob(Buffer.from('chunk!'), id, 6, limit), IntegrityError);
        assert.throws(() => decodeBlob(data, id, limit + 1, limit), ProtocolError);

        const { content, compressed } = program(11);
        assert.throws(() => decodeBlob(compressed, chunkIdOf(Buffer.from('other')), content.length, limit), (error: Error) => error instanceof IntegrityError && /content identifier/.test(error.message));
    });

    it('gives the same result as the order in which a blob was always checked, for valid and damaged blobs of any size', () => {
        for (let seed = 1; seed <= 150; seed++) {
            const { content, compressed, id } = program(seed);
            const damaged = Buffer.from(compressed);
            damaged[seed % damaged.length] ^= 0x55;
            const raw = content.subarray(0, 1 + (seed * 37) % Math.max(1, Math.min(content.length, 4000)));
            const cases: Array<[Buffer, string, number | undefined]> = [
                [compressed, id, content.length],
                [compressed, id, undefined],
                [compressed, id, content.length + 1],
                [compressed, id, compressed.length],
                [damaged, id, content.length],
                [content, id, content.length],
                [content, id, content.length - 1],
                [raw, chunkIdOf(raw), raw.length],
                [raw, chunkIdOf(raw), raw.length + 3],
                [raw, id, raw.length]
            ];
            for (const [data, identifier, size] of cases) {
                assert.deepStrictEqual(
                    outcomeOf(decodeBlob, data, identifier, size, limit),
                    outcomeOf(referenceDecode, data, identifier, size, limit),
                    `seed ${seed}, ${data.length} bytes, id ${identifier.substring(0, 6)}, size ${size}`);
            }
        }
    });
});
