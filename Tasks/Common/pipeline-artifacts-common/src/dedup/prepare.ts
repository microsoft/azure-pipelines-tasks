import * as fs from 'fs';
import * as path from 'path';
import { Logger, nullLogger } from '../util/logger';
import { forEachLimit, throwIfAborted } from '../util/concurrency';
import { ChunkerConfig, DedupHashType, chunkSource, getChunkerConfig, ChunkInfo } from './chunker';
import { BlobRef, EMPTY_CHUNK_ID } from './hashing';
import { ManifestItem, EMPTY_DIRECTORY_TYPE, buildManifest, checkManifestSize, estimateManifestBytes } from './manifest';
import { NodeBuilder, NodeRecord } from './nodes';
import { chunkBuffer } from './chunker';
import { ArtifactError } from '../errors';
import { leavesBase } from '../util/paths';
import { ArtifactIgnore } from './artifactIgnore';

export class SourceChangedError extends ArtifactError { }

export interface SourceFile {
    absolutePath: string;
    relativePath: string;
    size: number;
    mtimeMs: number;
}

export interface ChunkLocation {
    file: SourceFile;
    offset: number;
    size: number;
}

export interface PreparedArtifact {
    hashType: DedupHashType;
    files: SourceFile[];
    items: ManifestItem[];
    manifest: Buffer;
    manifestRoot: BlobRef;
    contentRoot: BlobRef | undefined;
    superRoot: BlobRef;
    proofs: Buffer[];
    nodes: Map<string, NodeRecord>;
    chunks: Map<string, ChunkLocation>;
    inlineChunks: Map<string, Buffer>;
    contentSize: number;
}

export interface PrepareOptions {
    sourcePath: string;
    hashType: DedupHashType;
    logger?: Logger;
    signal?: AbortSignal;
    concurrency?: number;
    followSymlinks?: boolean;
    /**
     * Skip symbolic links (and junctions) whose target is outside of the source directory. By default every link is
     * followed, like the agent plugin does; this switch is a hardening option for builds that run untrusted content.
     */
    skipExternalSymlinks?: boolean;
    useArtifactIgnore?: boolean;
    artifactIgnoreFlavor?: { ignoreCase: boolean; windows: boolean };
    maxManifestBytes?: number;
}

const ARTIFACT_IGNORE = '.artifactignore';

const EMPTY_BLOB: BlobRef = { id: EMPTY_CHUNK_ID, size: 0 };

interface Walker {
    rootDirectory: string;
    rootReal: string;
    options: PrepareOptions;
    logger: Logger;
    filter: ArtifactIgnore | undefined;
    files: SourceFile[];
    emptyDirectories: string[];
}

function isWithin(root: string, candidate: string): boolean {
    const relative = path.relative(root, candidate);
    return relative === '' || !leavesBase(relative);
}

async function loadIgnoreFilter(root: string, logger: Logger, flavor: PrepareOptions['artifactIgnoreFlavor']): Promise<ArtifactIgnore> {
    let content: string | undefined;
    try {
        content = await fs.promises.readFile(path.join(root, ARTIFACT_IGNORE), 'utf8');
        logger.info(`Using ${ARTIFACT_IGNORE} found in ${root}`);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && (error as NodeJS.ErrnoException).code !== 'ENOTDIR') {
            throw error;
        }
    }
    return ArtifactIgnore.parse(content, flavor?.ignoreCase, flavor?.windows, message => logger.warning(message));
}

async function walk(walker: Walker, directory: string, relativeDirectory: string, ancestors: ReadonlySet<string>): Promise<void> {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    if (entries.length === 0 && relativeDirectory) {
        if (walker.filter?.ignores(relativeDirectory)) {
            walker.logger.debug(`Ignoring directory ${relativeDirectory}`);
        } else {
            walker.emptyDirectories.push(relativeDirectory);
        }
        return;
    }

    for (const entry of entries) {
        const absolute = path.join(directory, entry.name);
        const relative = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;

        let stats: fs.Stats;
        try {
            stats = entry.isSymbolicLink() ? await fs.promises.stat(absolute) : await fs.promises.lstat(absolute);
        } catch (error) {
            const code = (error as NodeJS.ErrnoException).code;
            if (entry.isSymbolicLink() && (code === 'ENOENT' || code === 'ELOOP' || code === 'ENOTDIR')) {
                walker.logger.warning(`Skipping the broken symbolic link ${absolute}`);
                continue;
            }
            throw error;
        }

        if (entry.isSymbolicLink() && walker.options.followSymlinks === false) {
            walker.logger.debug(`Skipping the symbolic link ${absolute}`);
            continue;
        }

        let real: string | undefined;
        if (entry.isSymbolicLink()) {
            try {
                real = await fs.promises.realpath(absolute);
            } catch {
                walker.logger.warning(`Skipping the broken symbolic link ${absolute}`);
                continue;
            }
            if (walker.options.skipExternalSymlinks && !isWithin(walker.rootReal, real)) {
                walker.logger.warning(`Skipping the symbolic link ${absolute} because its target ${real} is outside of ${walker.rootDirectory}.`);
                continue;
            }
        }

        if (stats.isDirectory()) {
            if (walker.filter?.ignoresWholeDirectory(relative)) {
                walker.logger.debug(`Ignoring directory ${relative}`);
                continue;
            }
            if (real !== undefined && ancestors.has(real)) {
                walker.logger.warning(`Skipping the symbolic link ${absolute} because it points to one of its parent directories.`);
                continue;
            }
            const nextAncestors = real !== undefined ? new Set(ancestors).add(real) : ancestors;
            await walk(walker, absolute, relative, nextAncestors);
        } else if (stats.isFile()) {
            if (walker.filter?.ignores(relative)) {
                walker.logger.debug(`Ignoring ${relative}`);
                continue;
            }
            walker.files.push({ absolutePath: absolute, relativePath: relative, size: stats.size, mtimeMs: stats.mtimeMs });
        } else {
            walker.logger.warning(`Skipping ${absolute} because it is not a regular file.`);
        }
    }
}

export interface SourceListing {
    files: SourceFile[];
    emptyDirectories: string[];
}

function compareOrdinal(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

export async function listSource(options: PrepareOptions): Promise<SourceListing> {
    const logger = options.logger ?? nullLogger;
    const root = path.resolve(options.sourcePath);
    const stats = await fs.promises.stat(root);

    if (stats.isFile()) {
        return { files: [{ absolutePath: root, relativePath: path.basename(root), size: stats.size, mtimeMs: stats.mtimeMs }], emptyDirectories: [] };
    }
    if (!stats.isDirectory()) {
        throw new ArtifactError(`The path '${root}' is neither a file nor a directory.`);
    }

    const rootReal = await fs.promises.realpath(root);
    const walker: Walker = {
        rootDirectory: root,
        rootReal,
        options,
        logger,
        filter: options.useArtifactIgnore === false ? undefined : await loadIgnoreFilter(root, logger, options.artifactIgnoreFlavor),
        files: [],
        emptyDirectories: []
    };
    await walk(walker, root, '', new Set([rootReal]));

    // Ordinal (UTF-16 code unit) ordering of the artifact paths, as the reference client does.
    walker.files.sort((a, b) => compareOrdinal(a.relativePath, b.relativePath));
    walker.emptyDirectories.sort(compareOrdinal);
    return { files: walker.files, emptyDirectories: walker.emptyDirectories };
}

export async function listSourceFiles(options: PrepareOptions): Promise<SourceFile[]> {
    return (await listSource(options)).files;
}

async function chunkFile(file: SourceFile, config: ChunkerConfig, builder: NodeBuilder, chunks: Map<string, ChunkLocation>, inline: Map<string, Buffer>): Promise<BlobRef> {
    const handle = await fs.promises.open(file.absolutePath, 'r');
    try {
        const refs: BlobRef[] = [];
        const total = await chunkSource(handle, config, (chunk: ChunkInfo) => {
            refs.push({ id: chunk.id, size: chunk.size });
            if (!chunks.has(chunk.id)) {
                chunks.set(chunk.id, { file, offset: chunk.offset, size: chunk.size });
            }
        });

        // The snapshot of a file is what was read: a file that is still being appended to (a log) is published as it
        // was read. If its bytes change before the chunks are uploaded, the upload verification fails the task.
        file.size = total;

        if (refs.length === 0) {
            inline.set(EMPTY_CHUNK_ID, Buffer.alloc(0));
            return { id: EMPTY_CHUNK_ID, size: 0 };
        }
        return builder.tree(refs);
    } finally {
        await handle.close();
    }
}

export async function prepareArtifact(options: PrepareOptions): Promise<PreparedArtifact> {
    const logger = options.logger ?? nullLogger;
    const config = getChunkerConfig(options.hashType);
    const listing = await listSource(options);
    const files = listing.files;
    checkManifestSize(estimateManifestBytes(files.map(file => '/' + file.relativePath), listing.emptyDirectories.map(directory => '/' + directory)), options.maxManifestBytes);
    logger.info(`Processing ${files.length} file(s)...`);

    const builder = new NodeBuilder();
    const chunks = new Map<string, ChunkLocation>();
    const inlineChunks = new Map<string, Buffer>();
    const blobs = new Map<SourceFile, BlobRef>();

    let processed = 0;
    let lastReport = Date.now();
    await forEachLimit(files, options.concurrency ?? 4, async file => {
        throwIfAborted(options.signal);
        blobs.set(file, await chunkFile(file, config, builder, chunks, inlineChunks));
        processed++;
        if (Date.now() - lastReport > 15000) {
            lastReport = Date.now();
            logger.info(`Processed ${processed} of ${files.length} file(s).`);
        }
    }, options.signal);

    const items: ManifestItem[] = [
        ...files.map(file => ({ path: '/' + file.relativePath, blob: blobs.get(file)! })),
        ...listing.emptyDirectories.map(directory => ({ path: '/' + directory, type: EMPTY_DIRECTORY_TYPE } as ManifestItem))
    ].sort((a, b) => compareOrdinal(a.path, b.path));
    if (listing.emptyDirectories.length > 0) {
        // An empty directory has no content of its own: the BlobStore client lists the empty blob for it in the content root.
        inlineChunks.set(EMPTY_CHUNK_ID, Buffer.alloc(0));
    }

    const proofs: Buffer[] = [];
    // The content root references every distinct file blob once. Files with identical content share a blob.
    // An artifact without any item (everything was ignored) has no content root at all.
    let contentRoot: BlobRef | undefined;
    if (items.length > 0) {
        const distinct = new Map<string, BlobRef>();
        for (const item of items) {
            const blob = item.blob ?? EMPTY_BLOB;
            if (!distinct.has(blob.id)) {
                distinct.set(blob.id, blob);
            }
        }
        contentRoot = builder.tree(Array.from(distinct.values()), { forceNode: true, proofs });
    }

    const manifest = buildManifest(items);
    checkManifestSize(manifest.length, options.maxManifestBytes);
    const manifestChunks = chunkBuffer(manifest, config);
    const manifestRefs: BlobRef[] = manifestChunks.map(chunk => {
        const data = Buffer.from(manifest.subarray(chunk.offset, chunk.offset + chunk.size));
        inlineChunks.set(chunk.id, data);
        return { id: chunk.id, size: chunk.size };
    });
    const manifestRoot = builder.tree(manifestRefs);
    const superRoot = builder.node(contentRoot ? [contentRoot, manifestRoot] : [manifestRoot], proofs);

    return {
        hashType: options.hashType,
        files,
        items,
        manifest,
        manifestRoot,
        contentRoot,
        superRoot,
        proofs,
        nodes: builder.nodes,
        chunks,
        inlineChunks,
        contentSize: files.reduce((sum, file) => sum + file.size, 0)
    };
}
