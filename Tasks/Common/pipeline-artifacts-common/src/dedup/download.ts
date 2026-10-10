import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { IntegrityError } from '../errors';
import { Logger, nullLogger } from '../util/logger';
import { Semaphore, forEachLimit, throwIfAborted } from '../util/concurrency';
import { renameWithRetry } from '../util/files';
import { MatchOptions, DEFAULT_MATCH_OPTIONS, matchAnyPattern } from '../util/patterns';
import { artifactPathSegments, resolveInside } from '../util/paths';
import { BlobReader } from './blobReader';
import { BlobRef, MAX_CHUNK_BYTES } from './hashing';
import { EMPTY_DIRECTORY_TYPE, ManifestItem, parseManifest } from './manifest';

export interface DedupDownloadOptions {
    reader: BlobReader;
    manifestId: string;
    targetDirectory: string;
    subDirectory?: string;
    matchPrefix?: string;
    patterns?: readonly string[];
    matchOptions?: MatchOptions;
    fileConcurrency?: number;
    chunkConcurrency?: number;
    /** The most chunks that are being downloaded or wait to be written at the same time, for all files together. */
    maxBufferedChunks?: number;
    logger?: Logger;
    signal?: AbortSignal;
}

export interface DownloadSummary {
    files: number;
    bytes: number;
    skipped: number;
}

/** Many small files need many requests in flight; every file in flight holds one open file handle, so this stays well below the default Linux limit of 1024. */
export const DEFAULT_FILE_CONCURRENCY = 128;

/** A chunk is at most 2 MiB, so this keeps the memory for chunks below about 512 MiB, whatever the speed of the disk. The request gate of the reader (192 by default) fits inside. */
export const DEFAULT_MAX_BUFFERED_CHUNKS = 256;

async function ensureDirectory(directory: string, created: Set<string>): Promise<void> {
    if (!created.has(directory)) {
        await fs.promises.mkdir(directory, { recursive: true });
        created.add(directory);
    }
}

/** FileHandle.write may write fewer bytes than requested, so write until the whole buffer is on disk. */
async function writeFully(handle: fs.promises.FileHandle, data: Buffer, position: number): Promise<void> {
    let written = 0;
    while (written < data.length) {
        const { bytesWritten } = await handle.write(data, written, data.length - written, position + written);
        if (bytesWritten <= 0) {
            throw new IntegrityError('A file write made no progress.');
        }
        written += bytesWritten;
    }
}
export async function downloadBlobToFile(
    reader: BlobReader,
    ref: BlobRef,
    destination: string,
    chunkConcurrency: number,
    signal?: AbortSignal,
    budget?: Semaphore
): Promise<number> {
    const temporary = path.join(path.dirname(destination), `.${path.basename(destination).substring(0, 64)}.${crypto.randomBytes(4).toString('hex')}.tmp`);
    let handle: fs.promises.FileHandle | undefined;
    try {
        const leaves = await reader.leaves(ref);
        const total = leaves.reduce((sum, leaf) => sum + leaf.size, 0);
        if (total !== ref.size) {
            throw new IntegrityError(`The content of '${path.basename(destination)}' does not match its advertised size.`);
        }

        handle = await fs.promises.open(temporary, 'w');
        let offset = 0;
        const work = leaves.map(leaf => {
            const entry = { leaf, offset };
            offset += leaf.size;
            return entry;
        });

        const open = handle;
        await forEachLimit(work, chunkConcurrency, async ({ leaf, offset: position }) => {
            const release = await budget?.acquire();
            try {
                throwIfAborted(signal);
                const data = await reader.getBlob(leaf.id, leaf.size, MAX_CHUNK_BYTES);
                if (data.length !== leaf.size) {
                    throw new IntegrityError(`A chunk of '${path.basename(destination)}' has an unexpected size.`);
                }
                await writeFully(open, data, position);
            } finally {
                release?.();
            }
        }, signal);

        await handle.close();
        handle = undefined;
        if ((await fs.promises.stat(temporary)).size !== total) {
            throw new IntegrityError(`The file '${path.basename(destination)}' was not written completely.`);
        }
        await renameWithRetry(temporary, destination);
        return total;
    } catch (error) {
        await handle?.close().catch(() => undefined);
        await fs.promises.unlink(temporary).catch(() => undefined);
        throw error;
    }
}

export interface PlannedFile {
    item: ManifestItem;
    segments: string[];
    matchPath: string;
}

export async function planDownload(options: Pick<DedupDownloadOptions, 'reader' | 'manifestId' | 'matchPrefix' | 'patterns' | 'matchOptions' | 'logger'>): Promise<{ selected: PlannedFile[]; total: number }> {
    const logger = options.logger ?? nullLogger;
    const manifest = parseManifest(await options.reader.readManifest(options.manifestId));
    const planned: PlannedFile[] = manifest.map(item => {
        const segments = artifactPathSegments(item.path);
        const relative = segments.join('/');
        return { item, segments, matchPath: options.matchPrefix ? `${options.matchPrefix}/${relative}` : relative };
    });

    const patterns = (options.patterns ?? []).filter(pattern => pattern.trim() !== '');
    if (patterns.length === 0) {
        return { selected: planned, total: planned.length };
    }

    const matched = new Set(matchAnyPattern(planned.map(file => file.matchPath), patterns, options.matchOptions ?? DEFAULT_MATCH_OPTIONS, logger));
    return { selected: planned.filter(file => matched.has(file.matchPath)), total: planned.length };
}

export async function downloadManifestArtifact(options: DedupDownloadOptions): Promise<DownloadSummary> {
    const logger = options.logger ?? nullLogger;
    const { selected, total } = await planDownload(options);
    logger.info(`Artifact manifest contains ${total} file(s); downloading ${selected.length}.`);

    const root = options.subDirectory
        ? resolveInside(options.targetDirectory, artifactPathSegments('/' + options.subDirectory.replace(/\\/g, '/')))
        : path.resolve(options.targetDirectory);
    await fs.promises.mkdir(root, { recursive: true });

    const directories = new Set<string>();
    let bytes = 0;
    let completed = 0;
    let lastReport = Date.now();

    // One failed file stops the others, so that no more chunks are requested for a download that cannot succeed.
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (options.signal?.aborted) {
        abort();
    } else {
        options.signal?.addEventListener('abort', abort, { once: true });
    }
    const signal = controller.signal;
    const budget = new Semaphore(Math.max(1, options.maxBufferedChunks ?? Math.max(DEFAULT_MAX_BUFFERED_CHUNKS, (options.reader.concurrency ?? 0) + 64)));
    let firstFailure: { error: unknown } | undefined;

    try {
        await forEachLimit(selected, options.fileConcurrency ?? DEFAULT_FILE_CONCURRENCY, async file => {
            try {
                throwIfAborted(signal);
                const destination = resolveInside(root, file.segments);
                if (file.item.type === EMPTY_DIRECTORY_TYPE) {
                    await ensureDirectory(destination, directories);
                    return;
                }

                await ensureDirectory(path.dirname(destination), directories);
                const written = await downloadBlobToFile(options.reader, file.item.blob!, destination, options.chunkConcurrency ?? 32, signal, budget);
                bytes += written;
                completed++;
                logger.debug(`Downloaded ${file.item.path} (${written} bytes)`);
                if (Date.now() - lastReport > 15000) {
                    lastReport = Date.now();
                    logger.info(`Downloaded ${completed} of ${selected.length} file(s), ${bytes} bytes so far.`);
                }
            } catch (error) {
                firstFailure = firstFailure ?? { error };
                abort();
                throw error;
            }
        }, signal);
    } catch (error) {
        throw firstFailure ? firstFailure.error : error;
    } finally {
        options.signal?.removeEventListener('abort', abort);
    }

    return { files: selected.filter(file => file.item.type !== EMPTY_DIRECTORY_TYPE).length, bytes, skipped: total - selected.length };
}
