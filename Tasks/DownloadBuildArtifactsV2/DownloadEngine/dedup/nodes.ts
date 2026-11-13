import { BlobRef, MAX_NODE_CHILDREN, NODE_SUFFIX } from './hashing';

const TWO_32 = 0x100000000;
const MAX_SAFE_NODE_SIZE = Number.MAX_SAFE_INTEGER;

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
 * Reads a dedup node: two zero bytes (version), uint16 little endian (child count - 1) and then
 * per child a type byte (0 chunk, 1 node), the child size (3 bytes for chunks, 7 bytes for nodes) and
 * the 32 byte hash of the child.
 */
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
