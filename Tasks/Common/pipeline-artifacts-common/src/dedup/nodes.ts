import { BlobRef, MAX_CHUNK_BYTES, MAX_NODE_CHILDREN, NODE_SUFFIX, isNodeId, nodeIdOf, normalizeDedupId } from './hashing';

const TWO_32 = 0x100000000;
const MAX_SAFE_NODE_SIZE = Number.MAX_SAFE_INTEGER;

function writeSize(buffer: Buffer, offset: number, size: number, width: 3 | 7): void {
    if (!Number.isSafeInteger(size) || size < 0 || (width === 3 && size > MAX_CHUNK_BYTES)) {
        throw new Error('A dedup child size cannot be represented in the node format.');
    }
    if (width === 3) {
        buffer.writeUIntLE(size, offset, 3);
    } else {
        buffer.writeUInt32LE(size % TWO_32, offset);
        buffer.writeUIntLE(Math.floor(size / TWO_32), offset + 4, 3);
    }
}

function readSize(buffer: Buffer, offset: number, width: 3 | 7): number {
    if (width === 3) {
        return buffer.readUIntLE(offset, 3);
    }
    const value = buffer.readUIntLE(offset + 4, 3) * TWO_32 + buffer.readUInt32LE(offset);
    if (value > MAX_SAFE_NODE_SIZE) {
        throw new Error('Dedup node size exceeds the supported range.');
    }
    return value;
}

/**
 * Serializes a dedup node: two zero bytes (version), uint16 little endian (child count - 1) and then
 * per child a type byte (0 chunk, 1 node), the child size (3 bytes for chunks, 7 bytes for nodes) and
 * the 32 byte hash of the child.
 */
export function serializeNode(children: readonly BlobRef[]): Buffer {
    if (children.length < 1 || children.length > MAX_NODE_CHILDREN) {
        throw new Error(`Dedup nodes require 1 through ${MAX_NODE_CHILDREN} children.`);
    }

    let length = 4;
    for (const child of children) {
        length += 1 + (isNodeId(child.id) ? 7 : 3) + 32;
    }

    const data = Buffer.alloc(length);
    data.writeUInt16LE(0, 0);
    data.writeUInt16LE(children.length - 1, 2);
    let offset = 4;
    for (const child of children) {
        const id = normalizeDedupId(child.id);
        const node = isNodeId(id);
        data[offset++] = node ? 1 : 0;
        writeSize(data, offset, child.size, node ? 7 : 3);
        offset += node ? 7 : 3;
        data.write(id.substring(0, 64), offset, 32, 'hex');
        offset += 32;
    }
    return data;
}

export function parseNode(data: Buffer): BlobRef[] {
    if (data.length < 4) {
        throw new Error('Truncated dedup node header.');
    }
    if (data.readUInt16LE(0) !== 0) {
        throw new Error('Unsupported dedup node format version.');
    }

    const count = data.readUInt16LE(2) + 1;
    if (count > MAX_NODE_CHILDREN) {
        throw new Error('Dedup node contains more than 512 children.');
    }

    const children: BlobRef[] = [];
    let offset = 4;
    for (let i = 0; i < count; i++) {
        if (offset >= data.length) {
            throw new Error('Truncated dedup node entry.');
        }
        const kind = data[offset];
        if (kind !== 0 && kind !== 1) {
            throw new Error('Unsupported dedup child type.');
        }
        const width = kind === 0 ? 3 : 7;
        const end = offset + 1 + width + 32;
        if (end > data.length) {
            throw new Error('Truncated dedup node entry.');
        }
        const size = readSize(data, offset + 1, width);
        const hash = data.subarray(offset + 1 + width, end).toString('hex').toUpperCase();
        children.push({ id: hash + (kind === 0 ? '01' : NODE_SUFFIX), size });
        offset = end;
    }

    if (offset !== data.length) {
        throw new Error('Dedup node contains unexpected trailing bytes.');
    }
    return children;
}

export interface NodeRecord {
    ref: BlobRef;
    children: BlobRef[];
    data: Buffer;
}

/**
 * Builds dedup node trees the way BuildXL's "maximally packed" algorithm does: complete groups of 512
 * children become nodes at each level and the leftover children are carried to the next level unchanged.
 */
export class NodeBuilder {
    readonly nodes = new Map<string, NodeRecord>();

    node(children: readonly BlobRef[], proofs?: Buffer[]): BlobRef {
        const data = serializeNode(children);
        const ref: BlobRef = { id: nodeIdOf(data), size: children.reduce((sum, child) => sum + child.size, 0) };
        if (!this.nodes.has(ref.id)) {
            this.nodes.set(ref.id, { ref, children: children.map(child => ({ id: child.id, size: child.size })), data });
        }
        proofs?.push(data);
        return ref;
    }

    tree(children: readonly BlobRef[], options: { forceNode?: boolean; proofs?: Buffer[] } = {}): BlobRef {
        if (children.length === 0) {
            throw new Error('A dedup tree requires at least one child.');
        }
        if (children.length === 1 && !options.forceNode) {
            return children[0];
        }

        let level = children.slice();
        while (level.length > MAX_NODE_CHILDREN) {
            const complete = Math.floor(level.length / MAX_NODE_CHILDREN) * MAX_NODE_CHILDREN;
            const parents: BlobRef[] = [];
            for (let offset = 0; offset < complete; offset += MAX_NODE_CHILDREN) {
                parents.push(this.node(level.slice(offset, offset + MAX_NODE_CHILDREN), options.proofs));
            }
            level = parents.concat(level.slice(complete));
        }
        return this.node(level, options.proofs);
    }
}
