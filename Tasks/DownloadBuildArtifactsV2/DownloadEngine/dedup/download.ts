import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { IntegrityError, WorkerUnavailableError } from '../errors';
import { HttpClientWorkerOptions } from '../http/httpClient';
import { Logger, nullLogger } from '../util/logger';
import { Semaphore, forEachLimit, throwIfAborted } from '../util/concurrency';
import { renameWithRetry } from '../util/files';
import { MatchOptions, DEFAULT_MATCH_OPTIONS, matchAnyPattern } from '../util/patterns';
import { artifactPathSegments, resolveInside } from '../util/paths';
import { telemetry } from '../util/telemetry';
import { BlobReader } from './blobReader';
import { BlobWorkerPool } from './blobWorkerPool';
import { WorkerJob } from './blobWorkerProtocol';
import { BlobRef, EMPTY_CHUNK_ID, MAX_CHUNK_BYTES, normalizeDedupId } from './hashing';
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
    maxBufferedChunks?: number;
    workers?: BlobWorkerPool;
    /** Worker threads are used when the download has at least this many bytes or this many files. */
    workerThresholds?: { bytes: number; files: number };
    urlLookaheadFiles?: number;
    logger?: Logger;
    signal?: AbortSignal;
}

export interface DownloadSummary {
    files: number;
    bytes: number;
    skipped: number;
}

/** Every file in flight holds an open handle, so this stays well below the default Linux limit of 1024. */
export const DEFAULT_FILE_CONCURRENCY = 128;

/**
 * Memory budget for chunks that are downloading or waiting to be written, one unit per MiB held. Chunks are about 1 MiB and at most
 * 2 MiB, so this keeps them below about 512 MiB whatever the speed of the disk. The reader's request gate (192 by default) fits inside.
 */
export const DEFAULT_MAX_BUFFERED_CHUNKS = 256;

const BUDGET_UNIT_BYTES = 1024 * 1024;

export function budgetFor(chunkBytes: number): number {
    return Math.max(1, Math.round(chunkBytes / BUDGET_UNIT_BYTES));
}

/**
 * Bytes of chunks that one file keeps in flight. Chunks of a pipeline artifact are about 1 MiB, so a few dozen requests fill the
 * connection; classic container chunks average 64 KiB and need several times as many requests for the same speed.
 */
const FILE_BYTES_IN_FLIGHT = 32 * 1024 * 1024;

/** Concurrent chunk requests for one file: at least `requested`, more for small chunks (up to the reader's limit), never more than the file has. */
export function chunkConcurrencyFor(requested: number, leaves: readonly BlobRef[], readerConcurrency: number): number {
    let wanted = Math.max(1, requested);
    if (leaves.length > wanted) {
        let total = 0;
        for (const leaf of leaves) {
            total += leaf.size;
        }
        wanted = Math.max(wanted, Math.min(Math.ceil(FILE_BYTES_IN_FLIGHT / Math.max(1, total / leaves.length)), readerConcurrency));
    }
    return Math.max(1, Math.min(leaves.length, wanted));
}

/**
 * How big a download must be, in bytes or in files, for worker threads to earn back their start, which costs about 60 ms. Measured against a
 * local blob server on 2, 4 and 8 processors, it depends on the requests that the download needs and on what the threads take over: the same
 * bytes need 16 times as many requests in a classic artifact (chunks of about 64 KiB) as in a pipeline artifact (about 1 MiB), and many small
 * files are many requests too; threads that download take over the requests, threads that only verify and write take over much less.
 */
export function workerLimits(downloads: boolean, smallChunks: boolean): { bytes: number; files: number } {
    return downloads
        ? { bytes: (smallChunks ? 12 : 48) * 1024 * 1024, files: 128 }
        : { bytes: (smallChunks ? 48 : 96) * 1024 * 1024, files: 4096 };
}

/**
 * Below this average file size the main thread is the limit when it downloads the blobs itself, so it keeps one processor to itself.
 * Threads that download the blobs leave it little to do, so they all run.
 */
export const SMALL_FILE_AVERAGE_BYTES = 256 * 1024;

/** Creates a directory once, however many files that need it start at the same time. */
async function ensureDirectory(directory: string, created: Map<string, Promise<void>>): Promise<void> {
    let pending = created.get(directory);
    if (!pending) {
        pending = fs.promises.mkdir(directory, { recursive: true }).then(() => undefined);
        created.set(directory, pending);
        // A directory that could not be created is tried again by the next file that needs it.
        pending.catch(() => created.delete(directory));
    }
    await pending;
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

/**
 * The service throttles URL calls (HTTP 503 with Retry-After: 5), so the URLs of upcoming blobs are resolved ahead, in few large calls,
 * and a download never stands still for the whole wait.
 */
export const URL_LOOKAHEAD_FILES = 16000;
/** Chunk URLs are resolved ahead by about URL_LOOKAHEAD_CHUNK_BYTES of data (some seconds of download), between these limits. */
export const URL_LOOKAHEAD_CHUNKS_MIN = 1000;
export const URL_LOOKAHEAD_CHUNKS_MAX = 10000;
const URL_LOOKAHEAD_CHUNK_BYTES = 700 * 1024 * 1024;
const URL_LOOKAHEAD_FILE_BATCH = 500;
const URL_LOOKAHEAD_CHUNK_BATCH = 500;
const URL_LOOKAHEAD_CALLS = 3;

export function chunkLookaheadWindow(leaves: readonly BlobRef[]): number {
    let total = 0;
    for (const leaf of leaves) {
        total += leaf.size;
    }
    const average = Math.max(1, total / Math.max(1, leaves.length));
    return Math.max(URL_LOOKAHEAD_CHUNKS_MIN, Math.min(URL_LOOKAHEAD_CHUNKS_MAX, Math.ceil(URL_LOOKAHEAD_CHUNK_BYTES / average)));
}

export class UrlLookahead {
    private next = 0;
    private started = 0;
    private outstanding = 0;
    private stopped = false;
    private readonly controller = new AbortController();

    constructor(
        private readonly reader: BlobReader,
        private readonly count: number,
        private readonly idAt: (index: number) => string | undefined,
        private readonly window: number,
        private readonly batchSize: number,
        private readonly onStop?: () => void
    ) { }

    /** `started` blobs are being or have been downloaded: resolves the URLs of those that follow, up to the window. */
    advance(started: number): void {
        this.started = Math.max(this.started, started);
        this.pump();
    }

    /** No further calls are made, and unsent ones are dropped so that a new attempt does not wait for them. */
    stop(): void {
        if (!this.stopped) {
            this.stopped = true;
            this.controller.abort();
            this.onStop?.();
        }
    }

    private pump(): void {
        while (!this.stopped && this.outstanding < URL_LOOKAHEAD_CALLS && this.next < this.count) {
            // Send only full batches, or what is left of the list, so that the calls stay large.
            const size = Math.min(this.batchSize, this.count - this.next, this.window);
            if (this.started + this.window - this.next < size) {
                break;
            }
            const end = this.next + size;
            const batch: string[] = [];
            for (let index = this.next; index < end; index++) {
                const id = this.idAt(index);
                if (id) {
                    batch.push(id);
                }
            }
            this.next = end;
            if (batch.length === 0) {
                continue;
            }
            this.outstanding++;
            // A failure is not reported here: the download that needs the URL asks again and reports it.
            this.reader.prefetchUrls(batch, this.controller.signal).catch(() => undefined).finally(() => {
                this.outstanding--;
                this.pump();
            });
        }
    }
}

function startLookahead(reader: BlobReader, count: number, idAt: (index: number) => string | undefined, window: number, batchSize: number, onStop?: () => void): UrlLookahead | undefined {
    if (typeof reader.prefetchUrls !== 'function') {
        return undefined;
    }
    const lookahead = new UrlLookahead(reader, count, idAt, window, batchSize, onStop);
    lookahead.advance(0);
    return lookahead;
}

export function startFileLookahead(reader: BlobReader, count: number, idAt: (index: number) => string | undefined, window: number = URL_LOOKAHEAD_FILES): UrlLookahead | undefined {
    return startLookahead(reader, count, idAt, Math.max(1, window), URL_LOOKAHEAD_FILE_BATCH);
}

/** Files that run side by side share the bandwidth, so only this many keep their chunk URLs resolved ahead. */
const MAX_CHUNK_LOOKAHEADS = 2;
const activeChunkLookaheads = new WeakMap<BlobReader, number>();

function startChunkLookahead(reader: BlobReader, leaves: readonly BlobRef[]): UrlLookahead | undefined {
    const active = activeChunkLookaheads.get(reader) ?? 0;
    if (active >= MAX_CHUNK_LOOKAHEADS || typeof reader.prefetchUrls !== 'function') {
        return undefined;
    }
    activeChunkLookaheads.set(reader, active + 1);
    return startLookahead(
        reader,
        leaves.length,
        index => leaves[index].id === EMPTY_CHUNK_ID ? undefined : leaves[index].id,
        chunkLookaheadWindow(leaves),
        URL_LOOKAHEAD_CHUNK_BATCH,
        () => activeChunkLookaheads.set(reader, Math.max(0, (activeChunkLookaheads.get(reader) ?? 1) - 1)));
}

async function storeChunk(reader: BlobReader, leaf: BlobRef, handle: fs.promises.FileHandle, position: number, name: string, workers?: BlobWorkerPool): Promise<void> {
    if (workers?.available && leaf.id !== EMPTY_CHUNK_ID) {
        try {
            const job: WorkerJob = { type: 'chunk', id: leaf.id, size: leaf.size, limit: MAX_CHUNK_BYTES, fd: handle.fd, position };
            if (workers.canFetch) {
                await reader.fetchBlobInWorker(leaf.id, job, workers);
            } else {
                await reader.fetchBlob(leaf.id, MAX_CHUNK_BYTES, body => workers.run(job, body));
            }
            return;
        } catch (error) {
            // When the threads are gone the chunk is downloaded again and handled here; any other failure is the failure of the chunk.
            if (!(error instanceof WorkerUnavailableError)) {
                throw error;
            }
            telemetry.add('workerFallbacks');
        }
    }

    const data = await reader.getBlob(leaf.id, leaf.size, MAX_CHUNK_BYTES);
    if (data.length !== leaf.size) {
        throw new IntegrityError(`A chunk of '${name}' has an unexpected size.`);
    }
    await writeFully(handle, data, position);
}

/** A worker thread verifies the single chunk and creates the file. Returns false when no thread could do it. */
async function storeSingleChunkFile(reader: BlobReader, leaf: BlobRef, temporary: string, destination: string, workers: BlobWorkerPool): Promise<boolean> {
    try {
        const job: WorkerJob = { type: 'file', id: leaf.id, size: leaf.size, limit: MAX_CHUNK_BYTES, temporary, destination };
        if (workers.canFetch) {
            await reader.fetchBlobInWorker(leaf.id, job, workers);
        } else {
            await reader.fetchBlob(leaf.id, MAX_CHUNK_BYTES, body => workers.run(job, body));
        }
        return true;
    } catch (error) {
        if (error instanceof WorkerUnavailableError) {
            telemetry.add('workerFallbacks');
            return false;
        }
        throw error;
    }
}

// A random token per process plus a counter keeps temporary names unique and unpredictable without asking for random bytes per file.
const temporaryToken = crypto.randomBytes(6).toString('hex');
let temporaryCounter = 0;

function temporaryPathFor(destination: string): string {
    return path.join(path.dirname(destination), `.${path.basename(destination).substring(0, 64)}.${temporaryToken}${(temporaryCounter++).toString(36)}.tmp`);
}

export async function downloadBlobToFile(
    reader: BlobReader,
    ref: BlobRef,
    destination: string,
    chunkConcurrency: number,
    signal?: AbortSignal,
    budget?: Semaphore,
    workers?: BlobWorkerPool
): Promise<number> {
    const temporary = temporaryPathFor(destination);
    let handle: fs.promises.FileHandle | undefined;
    try {
        const leaves = await reader.leaves(ref);
        const total = leaves.reduce((sum, leaf) => sum + leaf.size, 0);
        if (total !== ref.size) {
            throw new IntegrityError(`The content of '${path.basename(destination)}' does not match its advertised size.`);
        }

        if (workers?.available && leaves.length === 1 && leaves[0].id !== EMPTY_CHUNK_ID) {
            // Creating a small file takes five calls on the main thread, and one call to a worker thread.
            const release = await budget?.acquire(budgetFor(leaves[0].size));
            try {
                throwIfAborted(signal);
                if (await storeSingleChunkFile(reader, leaves[0], temporary, destination, workers)) {
                    return total;
                }
            } finally {
                release?.();
            }
        }

        handle = await fs.promises.open(temporary, 'w');
        let offset = 0;
        const work = leaves.map(leaf => {
            const entry = { leaf, offset };
            offset += leaf.size;
            return entry;
        });

        const open = handle;
        const concurrency = chunkConcurrencyFor(chunkConcurrency, leaves, reader.concurrency ?? 0);
        // A file of few chunks asks for all its URLs in one call when its chunks start; a file of many is kept ahead.
        const lookahead = leaves.length > concurrency ? startChunkLookahead(reader, leaves) : undefined;
        try {
            await forEachLimit(work, concurrency, async ({ leaf, offset: position }, index) => {
                lookahead?.advance(index + 1);
                const release = await budget?.acquire(budgetFor(leaf.size));
                try {
                    throwIfAborted(signal);
                    await storeChunk(reader, leaf, open, position, path.basename(destination), workers);
                } finally {
                    release?.();
                }
            }, signal);
        } finally {
            lookahead?.stop();
        }

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
    const matchPathOf = (relative: string): string => options.matchPrefix ? `${options.matchPrefix}/${relative}` : relative;
    const plan = (item: ManifestItem): PlannedFile => {
        const segments = artifactPathSegments(item.path);
        return { item, segments, matchPath: matchPathOf(segments.join('/')) };
    };

    const patterns = (options.patterns ?? []).filter(pattern => pattern.trim() !== '');
    if (patterns.length === 0) {
        return { selected: manifest.map(plan), total: manifest.length };
    }

    // A path that cannot be restored only fails the download when a pattern selects it.
    const candidates = manifest.map(item => ({ item, matchPath: matchPathOf(item.path.replace(/^\//, '')) }));
    const matched = new Set(matchAnyPattern(candidates.map(candidate => candidate.matchPath), patterns, options.matchOptions ?? DEFAULT_MATCH_OPTIONS, logger));
    return { selected: candidates.filter(candidate => matched.has(candidate.matchPath)).map(candidate => plan(candidate.item)), total: manifest.length };
}

export interface WorkerStartOptions {
    /** Worker threads are used when the download has at least this many bytes or this many files; by default the limits that `workerLimits` gives. */
    thresholds?: { bytes: number; files: number };
    /** The threads download the blobs with these network settings, if their pool is set to download; otherwise the main thread downloads, and the threads verify and write. */
    network?: HttpClientWorkerOptions;
    /** The chunks are small, as those of a classic artifact are, so the same bytes need more requests. */
    smallChunks?: boolean;
}

/** Starts worker threads when the download is big enough to earn back their start; undefined means the main thread does the work. */
export async function startWorkersFor(pool: BlobWorkerPool | undefined, bytes: number, files: number, logger: Logger, options: WorkerStartOptions = {}): Promise<BlobWorkerPool | undefined> {
    if (!pool) {
        return undefined;
    }
    const network = pool.downloads ? options.network : undefined;
    const limits = options.thresholds ?? workerLimits(network !== undefined, options.smallChunks === true);
    if (bytes < limits.bytes && files < limits.files) {
        logger.debug(`The download is below the limits for worker threads (${Math.round(limits.bytes / (1024 * 1024))} MiB or ${limits.files} files): the blobs are downloaded, verified and written on the main thread.`);
        return undefined;
    }
    const small = !network && files > 0 && bytes / files < SMALL_FILE_AVERAGE_BYTES;
    const threads = small ? Math.max(1, pool.size - 1) : pool.size;
    if (network) {
        pool.configureNetwork(network);
    }
    if (!await pool.start(threads)) {
        telemetry.add('workerStartFailures');
        logger.debug('Worker threads cannot be started: the blobs are downloaded, verified and written on the main thread.');
        return undefined;
    }
    telemetry.set('workerThreads', pool.running);
    logger.debug(`The blobs are ${pool.canFetch ? 'downloaded, ' : ''}verified and written by up to ${threads} worker thread(s).`);
    return pool;
}

async function startWorkers(options: DedupDownloadOptions, planned: readonly PlannedFile[], logger: Logger): Promise<BlobWorkerPool | undefined> {
    let bytes = 0;
    let files = 0;
    for (const file of planned) {
        if (file.item.type !== EMPTY_DIRECTORY_TYPE && file.item.blob) {
            bytes += file.item.blob.size;
            files++;
        }
    }
    const network = options.workers?.downloads ? options.reader.workerNetworkOptions() : undefined;
    return startWorkersFor(options.workers, bytes, files, logger, { thresholds: options.workerThresholds, network });
}

function lookaheadIdOf(file: PlannedFile): string | undefined {
    const blob = file.item.blob;
    if (file.item.type === EMPTY_DIRECTORY_TYPE || !blob) {
        return undefined;
    }
    try {
        const id = normalizeDedupId(blob.id);
        return id === EMPTY_CHUNK_ID ? undefined : id;
    } catch {
        // An invalid identifier is reported by the download of that file.
        return undefined;
    }
}

export async function downloadManifestArtifact(options: DedupDownloadOptions): Promise<DownloadSummary> {
    const logger = options.logger ?? nullLogger;
    const { selected, total } = await planDownload(options);
    logger.info(`Artifact manifest contains ${total} file(s); downloading ${selected.length}.`);

    // Like the agent plugin: the target folder is always created, the folder of an artifact only when something is written into it,
    // so that an artifact without entries leaves no empty folder behind when all artifacts are downloaded.
    const target = path.resolve(options.targetDirectory);
    await fs.promises.mkdir(target, { recursive: true });
    const root = options.subDirectory
        ? resolveInside(options.targetDirectory, artifactPathSegments('/' + options.subDirectory.replace(/\\/g, '/')))
        : target;

    const directories = new Map<string, Promise<void>>();
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
    const workers = await startWorkers(options, selected, logger);
    const budget = new Semaphore(Math.max(1, options.maxBufferedChunks ?? Math.max(DEFAULT_MAX_BUFFERED_CHUNKS, (options.reader.concurrency ?? 0) + 64)));
    const lookahead = startFileLookahead(options.reader, selected.length, index => lookaheadIdOf(selected[index]), options.urlLookaheadFiles);
    let firstFailure: { error: unknown } | undefined;

    try {
        await forEachLimit(selected, options.fileConcurrency ?? DEFAULT_FILE_CONCURRENCY, async (file, index) => {
            try {
                throwIfAborted(signal);
                lookahead?.advance(index + 1);
                const destination = resolveInside(root, file.segments);
                if (file.item.type === EMPTY_DIRECTORY_TYPE) {
                    await ensureDirectory(destination, directories);
                    return;
                }

                await ensureDirectory(path.dirname(destination), directories);
                const written = await downloadBlobToFile(options.reader, file.item.blob!, destination, options.chunkConcurrency ?? 32, signal, budget, workers);
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
        lookahead?.stop();
        options.signal?.removeEventListener('abort', abort);
    }

    return { files: selected.filter(file => file.item.type !== EMPTY_DIRECTORY_TYPE).length, bytes, skipped: total - selected.length };
}
