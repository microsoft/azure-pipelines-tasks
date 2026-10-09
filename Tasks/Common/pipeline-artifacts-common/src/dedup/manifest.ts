import { BlobRef, MAX_CHUNK_BYTES, normalizeDedupId } from './hashing';
import { ArtifactError, ProtocolError } from '../errors';

export const MANIFEST_FORMAT = '1.1.0';

export const EMPTY_DIRECTORY_TYPE = 'EmptyDirectory';

/** The largest manifest that is published and read. A manifest is held in memory as text, and JavaScript strings are limited to about 512 MiB. */
export const MAX_MANIFEST_BYTES = 256 * 1024 * 1024;

/** A lower bound of the manifest size of a listing: the JSON of an item without its path takes at least this many bytes. */
const MIN_FILE_ITEM_BYTES = 100;
const MIN_DIRECTORY_ITEM_BYTES = 36;

export interface ManifestItem {
    path: string;
    blob?: BlobRef;
    type?: typeof EMPTY_DIRECTORY_TYPE;
}

export function estimateManifestBytes(filePaths: readonly string[], emptyDirectoryPaths: readonly string[]): number {
    const pathBytes = (paths: readonly string[]) => paths.reduce((sum, item) => sum + Buffer.byteLength(item), 0);
    return filePaths.length * MIN_FILE_ITEM_BYTES + pathBytes(filePaths) + emptyDirectoryPaths.length * MIN_DIRECTORY_ITEM_BYTES + pathBytes(emptyDirectoryPaths);
}

export function checkManifestSize(bytes: number, limit: number = MAX_MANIFEST_BYTES): void {
    if (bytes > limit) {
        const mebibytes = (value: number) => Math.round(value / (1024 * 1024));
        throw new ArtifactError(`The artifact has too many files: its manifest needs about ${mebibytes(bytes)} MiB and the supported limit is ${mebibytes(limit)} MiB. Publish fewer files, or archive some of them first.`);
    }
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseManifest(data: Buffer): ManifestItem[] {
    let document: unknown;
    try {
        document = JSON.parse(data.toString('utf8'));
    } catch {
        throw new ProtocolError('The artifact manifest is not valid JSON.');
    }

    if (!isRecord(document) || !Array.isArray(document.items)) {
        throw new ProtocolError('The artifact manifest has an unexpected structure.');
    }
    if (Array.isArray(document.manifestReferences) && document.manifestReferences.length > 0) {
        throw new ProtocolError('Artifact manifests that reference other manifests are not supported.');
    }

    const items: ManifestItem[] = [];
    for (const entry of document.items) {
        if (!isRecord(entry) || typeof entry.path !== 'string') {
            throw new ProtocolError('The artifact manifest contains an invalid item.');
        }

        const type = entry.type;
        if (type !== undefined && typeof type !== 'string') {
            throw new ProtocolError('The artifact manifest contains an invalid item.');
        }
        if (typeof type === 'string' && type.toLowerCase() === EMPTY_DIRECTORY_TYPE.toLowerCase()) {
            items.push({ path: entry.path, type: EMPTY_DIRECTORY_TYPE });
            continue;
        }
        if (type !== undefined && type.toLowerCase() !== 'file') {
            throw new ProtocolError(`The artifact manifest contains an item of the unsupported type '${type}'.`);
        }

        if (!isRecord(entry.blob)) {
            throw new ProtocolError('The artifact manifest contains an invalid item.');
        }
        const size = entry.blob.size;
        if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0) {
            throw new ProtocolError('The artifact manifest contains an invalid item size.');
        }
        const id = normalizeDedupId(entry.blob.id, 'manifest item identifier');
        if (id.endsWith('01') && size > MAX_CHUNK_BYTES) {
            throw new ProtocolError('The artifact manifest contains an invalid chunk size.');
        }
        items.push({ path: entry.path, blob: { id, size } });
    }
    return items;
}
