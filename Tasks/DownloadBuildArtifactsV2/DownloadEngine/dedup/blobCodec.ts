import { IntegrityError, ProtocolError } from '../errors';
import { chunkIdOf, isNodeId, nodeIdOf } from './hashing';
import { decompressChunk } from './lz77';

/**
 * Verifies the bytes served for a chunk or node against its identifier and returns its content. A blob smaller than its advertised
 * size is presumed LZ77 compressed and decompressed first; any other blob is hashed as served first. The other reading is the fallback.
 */
export function decodeBlob(data: Buffer, id: string, size: number | undefined, limit: number): Buffer {
    if (size !== undefined && size > limit) {
        throw new ProtocolError('The advertised blob size exceeds the supported limit.');
    }

    const hashOf = isNodeId(id) ? nodeIdOf : chunkIdOf;
    const compressedFirst = size !== undefined && data.length < size;
    if (!compressedFirst && data.length <= limit && hashOf(data) === id) {
        if (size !== undefined && data.length !== size) {
            throw new IntegrityError('A blob does not match its advertised size.');
        }
        return data;
    }

    let decoded: Buffer;
    try {
        decoded = decompressChunk(data, { maxOutputSize: limit, expectedSize: size });
    } catch (error) {
        if (compressedFirst && data.length <= limit && hashOf(data) === id) {
            throw new IntegrityError('A blob does not match its advertised size.');
        }
        throw new IntegrityError(`A blob is neither valid raw data nor supported compressed content: ${(error as Error).message}`);
    }
    if (hashOf(decoded) !== id) {
        throw new IntegrityError('A blob does not match its content identifier.');
    }
    return decoded;
}
