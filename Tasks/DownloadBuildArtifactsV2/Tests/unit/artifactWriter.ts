import * as fs from 'fs';
import * as path from 'path';
import { BlobRef, EMPTY_CHUNK_ID, MAX_CHUNK_BYTES, MAX_NODE_CHILDREN, chunkIdOf, isNodeId, nodeIdOf, normalizeDedupId } from '../../DownloadEngine/dedup/hashing';
import { EMPTY_DIRECTORY_TYPE, ManifestItem } from '../../DownloadEngine/dedup/manifest';
import { FakeService } from './fakeService';

/*
 * Puts artifacts into a fake service, so that the tests have something to download. The chunks, nodes and manifests follow the
 * format that the download code reads; how a file is cut into chunks is free, so the sizes here only look like those of a real artifact.
 */

const TWO_32 = 0x100000000;
const MANIFEST_FORMAT = '1.1.0';
const DEFAULT_AVERAGE_CHUNK_BYTES = 1024 * 1024;

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

/** The bytes of a dedup node: a version, the number of children and, per child, its kind, size and hash. */
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

export interface NodeRecord {
    ref: BlobRef;
    children: BlobRef[];
    data: Buffer;
}

/** Builds trees of dedup nodes: complete groups of 512 children become nodes at each level and the leftover children go up unchanged. */
export class NodeBuilder {
    readonly nodes = new Map<string, NodeRecord>();

    node(children: readonly BlobRef[]): BlobRef {
        const data = serializeNode(children);
        const ref: BlobRef = { id: nodeIdOf(data), size: children.reduce((sum, child) => sum + child.size, 0) };
        if (!this.nodes.has(ref.id)) {
            this.nodes.set(ref.id, { ref, children: children.map(child => ({ id: child.id, size: child.size })), data });
        }
        return ref;
    }

    tree(children: readonly BlobRef[]): BlobRef {
        if (children.length === 0) {
            throw new Error('A dedup tree requires at least one child.');
        }
        if (children.length === 1) {
            return children[0];
        }

        let level = children.slice();
        while (level.length > MAX_NODE_CHILDREN) {
            const complete = Math.floor(level.length / MAX_NODE_CHILDREN) * MAX_NODE_CHILDREN;
            const parents: BlobRef[] = [];
            for (let offset = 0; offset < complete; offset += MAX_NODE_CHILDREN) {
                parents.push(this.node(level.slice(offset, offset + MAX_NODE_CHILDREN)));
            }
            level = parents.concat(level.slice(complete));
        }
        return this.node(level);
    }
}

/** The manifest of an artifact in the format that the service stores: the files and empty directories with the blob of each file. */
export function buildManifest(items: readonly ManifestItem[]): Buffer {
    const document = {
        manifestFormat: MANIFEST_FORMAT,
        items: items.map(item => item.type === EMPTY_DIRECTORY_TYPE
            ? { path: item.path, type: EMPTY_DIRECTORY_TYPE }
            : { path: item.path, blob: { id: item.blob!.id, size: item.blob!.size } }),
        manifestReferences: [] as unknown[]
    };
    return Buffer.from(JSON.stringify(document), 'utf8');
}

/** Cuts data into chunks of varying size, from half to one and a half times the average, the same way for the same data. */
function cutIntoChunks(data: Buffer, averageBytes: number): Buffer[] {
    const minimum = Math.max(1, Math.floor(averageBytes / 2));
    const range = averageBytes + 1;
    const chunks: Buffer[] = [];
    let state = (0x9e3779b1 ^ data.length) >>> 0;
    for (let offset = 0; offset < data.length;) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        const size = Math.min(data.length - offset, minimum + state % range);
        chunks.push(data.subarray(offset, offset + size));
        offset += size;
    }
    return chunks;
}

function ordinal(left: string, right: string): number {
    return left < right ? -1 : left > right ? 1 : 0;
}

interface Listing {
    files: Array<{ path: string; content: Buffer }>;
    emptyDirectories: string[];
}

function list(directory: string, relative = '', listing: Listing = { files: [], emptyDirectories: [] }): Listing {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    if (entries.length === 0 && relative) {
        listing.emptyDirectories.push(relative);
    }
    for (const entry of entries) {
        const entryRelative = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            list(path.join(directory, entry.name), entryRelative, listing);
        } else if (entry.isFile()) {
            listing.files.push({ path: entryRelative, content: fs.readFileSync(path.join(directory, entry.name)) });
        }
    }
    return listing;
}

export interface AddArtifactOptions {
    projectId: string;
    buildId: number;
    artifactName: string;
    /** The folder whose files and empty folders make the artifact. */
    sourcePath: string;
    /** The average size of the chunks that a file is cut into: one MiB by default, which is the size of the chunks of this kind of artifact. */
    averageChunkBytes?: number;
    domainId?: string;
}

export interface AddedArtifact {
    artifactId: number;
    manifestId: string;
    contentSize: number;
    fileCount: number;
}

/** Stores the chunks, nodes and manifest of a folder in the service and adds the artifact to the build. */
export function addFolderArtifact(service: FakeService, options: AddArtifactOptions): AddedArtifact {
    const average = options.averageChunkBytes ?? DEFAULT_AVERAGE_CHUNK_BYTES;
    const listing = list(options.sourcePath);
    const builder = new NodeBuilder();
    const store = (data: Buffer): BlobRef => {
        const id = chunkIdOf(data);
        service.chunks.set(id, Buffer.from(data));
        return { id, size: data.length };
    };

    const items: ManifestItem[] = listing.files.map(file => {
        const refs = cutIntoChunks(file.content, average).map(store);
        if (refs.length === 0) {
            service.chunks.set(EMPTY_CHUNK_ID, Buffer.alloc(0));
        }
        return { path: '/' + file.path, blob: refs.length === 0 ? { id: EMPTY_CHUNK_ID, size: 0 } : builder.tree(refs) };
    });
    for (const directory of listing.emptyDirectories) {
        items.push({ path: '/' + directory, type: EMPTY_DIRECTORY_TYPE });
    }
    items.sort((left, right) => ordinal(left.path, right.path));

    const manifest = buildManifest(items);
    const manifestRoot = builder.tree(cutIntoChunks(manifest, average).map(store));
    for (const [id, record] of builder.nodes) {
        service.nodes.set(id, record.data);
    }

    const contentSize = listing.files.reduce((sum, file) => sum + file.content.length, 0);
    const artifact = service.addArtifact(options.projectId, options.buildId, {
        name: options.artifactName,
        source: 'job-1',
        resource: {
            type: 'PipelineArtifact',
            data: manifestRoot.id,
            properties: { DomainId: options.domainId ?? '0', artifactsize: String(contentSize) }
        }
    });
    return { artifactId: artifact.id, manifestId: manifestRoot.id, contentSize, fileCount: listing.files.length };
}
