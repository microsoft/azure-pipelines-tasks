import * as crypto from 'crypto';

// A dedup identifier is the first 32 bytes of SHA-512 (64 upper-case hex characters) followed by a
// one byte algorithm id: 01 for a chunk, 02 for a node (a serialized list of chunk/node references).
export const CHUNK_SUFFIX = '01';
export const NODE_SUFFIX = '02';

// 3 byte (2^24 - 1) chunk size and 7 byte node size limits of the serialized node format.
export const MAX_CHUNK_BYTES = (1 << 24) - 1;
export const MAX_NODE_CHILDREN = 512;
export const MAX_NODE_BYTES = 4 + MAX_NODE_CHILDREN * 40;

const DEDUP_ID = /^[0-9A-Fa-f]{64}(01|02)$/;

export interface BlobRef {
    id: string;
    size: number;
}

/** Dedup uses ordinary SHA-512 truncated to 32 bytes (not SHA-512/256). */
export function hashBuffer(data: Uint8Array): Buffer {
    return crypto.createHash('sha512').update(data).digest().subarray(0, 32);
}

export function chunkIdOf(data: Uint8Array): string {
    return hashBuffer(data).toString('hex').toUpperCase() + CHUNK_SUFFIX;
}

export function nodeIdOf(serializedNode: Uint8Array): string {
    return hashBuffer(serializedNode).toString('hex').toUpperCase() + NODE_SUFFIX;
}

export const EMPTY_CHUNK_ID = chunkIdOf(Buffer.alloc(0));

export function isDedupId(value: unknown): value is string {
    return typeof value === 'string' && DEDUP_ID.test(value);
}

export function isNodeId(id: string): boolean {
    return id.endsWith(NODE_SUFFIX);
}

export function isChunkId(id: string): boolean {
    return id.endsWith(CHUNK_SUFFIX);
}

export function normalizeDedupId(value: unknown, what: string = 'dedup identifier'): string {
    if (!isDedupId(value)) {
        throw new Error(`Invalid ${what}.`);
    }
    return value.toUpperCase();
}
