import { HttpClient, HttpClientWorkerOptions, isTransientError } from '../http/httpClient';
import { HttpError, IntegrityError, ProtocolError, UrlRequestDroppedError, WorkerFailedError } from '../errors';
import { Logger, nullLogger } from '../util/logger';
import { RetryOptions, Semaphore, forEachLimit, withRetry } from '../util/concurrency';
import { telemetry } from '../util/telemetry';
import { DedupTransport } from './blobStore';
import { decodeBlob } from './blobCodec';
import { blobRequestOptions } from './blobRequest';
import { BlobWorkerPool } from './blobWorkerPool';
import { WorkerJob } from './blobWorkerProtocol';
import { BlobRef, EMPTY_CHUNK_ID, MAX_CHUNK_BYTES, MAX_NODE_BYTES, isChunkId, isNodeId, normalizeDedupId } from './hashing';
import { MAX_MANIFEST_BYTES } from './manifest';
import { parseNode } from './nodes';

const URL_BATCH_SIZE = 200;
const PREFETCH_BATCH_SIZE = 500;
const MAX_BACKGROUND_RESOLVES = 3;
// Must exceed the URLs that are resolved ahead (files and chunks), or some would be evicted before they are used.
const URL_CACHE_SIZE = 40960;
const URL_TTL_MS = 5 * 60 * 1000;
const MAX_TREE_DEPTH = 64;
const NODE_CACHE_SIZE = 4096;
const MAX_INFLIGHT_RESOLVES = 6;
const MANIFEST_CHUNKS_AT_A_TIME = 8;

interface CachedUrl {
    url: string;
    resolvedAt: number;
}

interface PendingUrl {
    id: string;
    resolve: (url: string) => void;
    reject: (error: unknown) => void;
}

export interface BlobReaderOptions {
    transport: DedupTransport;
    http: HttpClient;
    logger?: Logger;
    concurrency?: number;
    signal?: AbortSignal;
}

export class BlobReader {
    readonly concurrency: number;
    private readonly transport: DedupTransport;
    private readonly http: HttpClient;
    private readonly logger: Logger;
    private readonly gate: Semaphore;
    private readonly signal?: AbortSignal;
    private readonly urls = new Map<string, CachedUrl>();
    private readonly pendingUrls = new Map<string, Promise<string>>();
    private readonly queue: PendingUrl[] = [];
    private readonly background = new Semaphore(MAX_BACKGROUND_RESOLVES);
    private inflightResolves = 0;
    private timer: NodeJS.Timeout | undefined;
    private readonly nodes = new Map<string, BlobRef[]>();

    constructor(options: BlobReaderOptions) {
        this.transport = options.transport;
        this.http = options.http;
        this.logger = options.logger ?? nullLogger;
        this.concurrency = Math.max(1, options.concurrency ?? 64);
        this.gate = new Semaphore(this.concurrency);
        this.signal = options.signal;
    }

    /** Records the pending request for the URL of a blob, so that concurrent askers share the answer. */
    private register(id: string): { promise: Promise<string>; entry: PendingUrl } {
        let entry!: PendingUrl;
        const promise = new Promise<string>((resolve, reject) => {
            entry = { id, resolve, reject };
        });
        this.pendingUrls.set(id, promise);
        const forget = () => {
            if (this.pendingUrls.get(id) === promise) {
                this.pendingUrls.delete(id);
            }
        };
        promise.then(forget, forget);
        return { promise, entry };
    }

    private resolveUrl(id: string, refresh: boolean): Promise<string> {
        if (!refresh) {
            const cached = this.urls.get(id);
            if (cached && Date.now() - cached.resolvedAt < URL_TTL_MS) {
                return Promise.resolve(cached.url);
            }
            const pending = this.pendingUrls.get(id);
            if (pending) {
                return pending;
            }
        } else {
            this.urls.delete(id);
        }

        const { promise, entry } = this.register(id);
        this.queue.push(entry);
        this.schedule();
        return promise;
    }

    // Coalesce requests: an idle resolver sends after a very short delay, a busy one lets the queue grow while earlier requests are in
    // flight, so that every request under load carries a full batch.
    private schedule(): void {
        if (this.queue.length >= URL_BATCH_SIZE) {
            this.drain();
        } else if (!this.timer && this.inflightResolves < MAX_INFLIGHT_RESOLVES) {
            this.timer = setTimeout(() => this.drain(), 2);
        }
    }

    private drain(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
        while (this.queue.length > 0 && this.inflightResolves < MAX_INFLIGHT_RESOLVES) {
            const batch = this.queue.splice(0, URL_BATCH_SIZE);
            this.inflightResolves++;
            void this.sendBatch(batch).finally(() => {
                this.inflightResolves--;
                if (this.queue.length > 0) {
                    this.drain();
                }
            });
        }
    }

    private async sendBatch(batch: PendingUrl[]): Promise<void> {
        const unique = Array.from(new Set(batch.map(entry => entry.id)));
        try {
            const resolved = await this.transport.resolveUrls(unique, this.signal);
            for (const entry of batch) {
                const url = resolved[entry.id];
                if (!url) {
                    entry.reject(new ProtocolError('The dedup service did not return a URL for a requested blob.'));
                    continue;
                }
                this.urls.set(entry.id, { url, resolvedAt: Date.now() });
                entry.resolve(url);
            }
            if (this.urls.size > URL_CACHE_SIZE) {
                // One pass over the oldest entries: asking a Map for its first key again and again gets slower as entries are deleted.
                let excess = this.urls.size - URL_CACHE_SIZE;
                for (const key of this.urls.keys()) {
                    this.urls.delete(key);
                    if (--excess <= 0) {
                        break;
                    }
                }
            }
        } catch (error) {
            batch.forEach(entry => entry.reject(error));
        }
    }

    /**
     * Resolves blob URLs ahead of their use. The calls run on their own, so that a call the service answers slowly or asks to repeat
     * holds up nobody else. When `signal` aborts, calls that were not sent yet are dropped, and whoever needs those URLs asks again.
     */
    async prefetchUrls(ids: readonly string[], signal?: AbortSignal): Promise<void> {
        const waiting: Array<Promise<string>> = [];
        const entries: PendingUrl[] = [];
        for (const id of new Set(ids)) {
            const cached = this.urls.get(id);
            if (cached && Date.now() - cached.resolvedAt < URL_TTL_MS) {
                continue;
            }
            const pending = this.pendingUrls.get(id);
            if (pending) {
                waiting.push(pending);
                continue;
            }
            const { promise, entry } = this.register(id);
            waiting.push(promise);
            entries.push(entry);
        }
        for (let offset = 0; offset < entries.length; offset += PREFETCH_BATCH_SIZE) {
            this.sendInBackground(entries.slice(offset, offset + PREFETCH_BATCH_SIZE), signal);
        }
        await Promise.all(waiting);
    }

    /**
     * Sends a prefetch call when its turn comes. When `signal` aborts first, the call is dropped on the spot: its waiters are told to
     * ask again, and neither a new prefetch of the same blobs nor the queue is left holding it.
     */
    private sendInBackground(batch: PendingUrl[], signal?: AbortSignal): void {
        let unsent: PendingUrl[] | undefined = batch;
        const drop = (): void => {
            const dropped = unsent;
            unsent = undefined;
            dropped?.forEach(entry => entry.reject(new UrlRequestDroppedError('The request for these blob URLs was dropped before it was sent.')));
        };
        if (signal?.aborted) {
            drop();
            return;
        }
        signal?.addEventListener('abort', drop, { once: true });
        void this.background.run(async () => {
            signal?.removeEventListener('abort', drop);
            const toSend = unsent;
            unsent = undefined;
            if (toSend) {
                await this.sendBatch(toSend);
            }
        });
    }

    async getBlob(id: string, size: number | undefined, limit: number = MAX_CHUNK_BYTES): Promise<Buffer> {
        if (id === EMPTY_CHUNK_ID) {
            if (size !== undefined && size !== 0) {
                throw new IntegrityError('The empty chunk does not match its advertised size.');
            }
            return Buffer.alloc(0);
        }

        return this.fetchBlob(id, limit, body => decodeBlob(body, id, size, limit));
    }

    /**
     * Downloads a blob and passes its bytes to `process`. `process` is inside the retry loop, so a blob that fails verification, or a
     * worker that fails to process it, is downloaded again.
     */
    async fetchBlob<T>(id: string, limit: number, process: (body: Buffer) => T | Promise<T>): Promise<T> {
        return this.gate.run(() => withRetry(async attempt => {
            const url = await this.resolveUrl(id, attempt > 0);
            let response;
            try {
                response = await this.http.request(url, blobRequestOptions(limit, this.signal));
            } catch (error) {
                this.noteRejectedUrl(id, error);
                throw error;
            }
            return process(response.body);
        }, this.retryOptions(id)));
    }

    /**
     * Like fetchBlob, but a worker thread downloads the blob from its URL and does the work of `job` with it, so that the requests do not
     * load the main thread. The URL, the number of requests in flight and the repeats of failed attempts are handled here as there.
     */
    async fetchBlobInWorker(id: string, job: WorkerJob, workers: BlobWorkerPool): Promise<Buffer | undefined> {
        return this.gate.run(() => withRetry(async attempt => {
            const url = await this.resolveUrl(id, attempt > 0);
            try {
                const result = await workers.fetch(job, url, this.signal);
                telemetry.add('workerFetches');
                return result;
            } catch (error) {
                this.noteRejectedUrl(id, error);
                throw error;
            }
        }, this.retryOptions(id)));
    }

    /** The network settings of this reader, for worker threads that download blobs for it. */
    workerNetworkOptions(): HttpClientWorkerOptions {
        return this.http.workerOptions();
    }

    private noteRejectedUrl(id: string, error: unknown): void {
        if (error instanceof HttpError && (error.status === 403 || error.status === 404 || error.status === 410)) {
            // A queued signed URL may have expired; the next attempt resolves a fresh one.
            this.logger.debug(`Blob URL for ${id.substring(0, 12)} was rejected (HTTP ${error.status}); resolving it again.`);
        }
    }

    private retryOptions(id: string): RetryOptions {
        return {
            retries: 4,
            baseDelayMs: 400,
            signal: this.signal,
            shouldRetry: error => error instanceof IntegrityError || error instanceof WorkerFailedError || error instanceof UrlRequestDroppedError || isTransientError(error) || (error instanceof HttpError && (error.status === 403 || error.status === 404 || error.status === 410)),
            delayHint: error => error instanceof HttpError ? error.retryAfterMs : undefined,
            onRetry: (error, attempt, wait) => {
                telemetry.add('blobRetries');
                if (error instanceof IntegrityError) {
                    telemetry.add('integrityRetries');
                } else if (error instanceof WorkerFailedError) {
                    telemetry.add('workerFailures');
                }
                this.logger.debug(`Retrying blob ${id.substring(0, 12)} (attempt ${attempt + 1}) in ${wait}ms: ${(error as Error).message}`);
            }
        };
    }

    async getNodeChildren(id: string, expectedSize?: number): Promise<BlobRef[]> {
        const normalized = normalizeDedupId(id);
        if (!isNodeId(normalized)) {
            throw new ProtocolError('A dedup node identifier was expected.');
        }
        let children = this.nodes.get(normalized);
        if (!children) {
            children = parseNode(await this.getBlob(normalized, undefined, MAX_NODE_BYTES));
            for (const child of children) {
                if (isChunkId(child.id) && child.size > MAX_CHUNK_BYTES) {
                    throw new ProtocolError('A dedup node references a chunk that exceeds the supported size.');
                }
            }
            this.nodes.set(normalized, children);
            while (this.nodes.size > NODE_CACHE_SIZE) {
                this.nodes.delete(this.nodes.keys().next().value as string);
            }
        }
        if (expectedSize !== undefined && children.reduce((sum, child) => sum + child.size, 0) !== expectedSize) {
            throw new IntegrityError('The children of a dedup node do not add up to its advertised size.');
        }
        return children;
    }

    async leaves(ref: BlobRef): Promise<BlobRef[]> {
        const id = normalizeDedupId(ref.id);
        if (isChunkId(id)) {
            if (ref.size > MAX_CHUNK_BYTES) {
                throw new ProtocolError('A chunk exceeds the supported size.');
            }
            return [{ id, size: ref.size }];
        }

        const result: BlobRef[] = [];
        await this.collect({ id, size: ref.size }, new Set(), result);
        return result;
    }

    private async collect(node: BlobRef, ancestors: ReadonlySet<string>, into: BlobRef[]): Promise<void> {
        if (ancestors.size >= MAX_TREE_DEPTH || ancestors.has(node.id)) {
            throw new ProtocolError('The dedup tree is cyclic or exceeds the supported depth.');
        }
        const children = await this.getNodeChildren(node.id, node.size);
        const next = new Set(ancestors).add(node.id);
        const parts = await Promise.all(children.map(async child => {
            if (isChunkId(child.id)) {
                return [child];
            }
            const nested: BlobRef[] = [];
            await this.collect(child, next, nested);
            return nested;
        }));
        for (const part of parts) {
            for (const leaf of part) {
                into.push(leaf);
            }
        }
    }

    async readAll(ref: BlobRef, limit: number): Promise<Buffer> {
        if (ref.size > limit) {
            throw new ProtocolError('The blob exceeds the configured size limit.');
        }
        const leaves = await this.leaves(ref);
        // One URL call for all chunks and a few chunks at a time: fetched one after the other, each chunk would wait for the service twice.
        await this.prefetchUrls(leaves.map(leaf => leaf.id)).catch(() => undefined);
        const parts: Buffer[] = new Array(leaves.length);
        await forEachLimit(leaves, MANIFEST_CHUNKS_AT_A_TIME, async (leaf, index) => {
            parts[index] = await this.getBlob(leaf.id, leaf.size, MAX_CHUNK_BYTES);
        }, this.signal);
        let total = 0;
        for (const part of parts) {
            total += part.length;
        }
        if (total > limit) {
            throw new ProtocolError('The blob exceeds the configured size limit.');
        }
        return Buffer.concat(parts);
    }

    async readManifest(manifestId: string, limit: number = MAX_MANIFEST_BYTES): Promise<Buffer> {
        const id = normalizeDedupId(manifestId, 'manifest identifier');
        if (isChunkId(id)) {
            return this.getBlob(id, undefined, Math.min(limit, MAX_CHUNK_BYTES));
        }
        const children = await this.getNodeChildren(id);
        const size = children.reduce((sum, child) => sum + child.size, 0);
        return this.readAll({ id, size }, limit);
    }
}
