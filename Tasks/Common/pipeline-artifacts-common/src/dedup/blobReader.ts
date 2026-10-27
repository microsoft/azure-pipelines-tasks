import { HttpClient, isTransientError } from '../http/httpClient';
import { HttpError, IntegrityError, ProtocolError } from '../errors';
import { Logger, nullLogger } from '../util/logger';
import { Semaphore, withRetry } from '../util/concurrency';
import { DedupTransport } from './blobStore';
import { BlobRef, EMPTY_CHUNK_ID, MAX_CHUNK_BYTES, MAX_NODE_BYTES, chunkIdOf, isChunkId, isNodeId, nodeIdOf, normalizeDedupId } from './hashing';
import { decompressChunk } from './lz77';
import { MAX_MANIFEST_BYTES } from './manifest';
import { parseNode } from './nodes';

const URL_BATCH_SIZE = 100;
const URL_CACHE_SIZE = 8192;
const URL_TTL_MS = 5 * 60 * 1000;
const MAX_TREE_DEPTH = 64;
const NODE_CACHE_SIZE = 4096;
const MAX_INFLIGHT_RESOLVES = 6;

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

        const promise = new Promise<string>((resolve, reject) => {
            this.queue.push({ id, resolve, reject });
            this.schedule();
        });
        this.pendingUrls.set(id, promise);
        const forget = () => {
            if (this.pendingUrls.get(id) === promise) {
                this.pendingUrls.delete(id);
            }
        };
        promise.then(forget, forget);
        return promise;
    }

    // Requests are coalesced: an idle resolver sends after a very short delay, a busy one lets the queue grow
    // while earlier requests are in flight so that under load every request carries a full batch.
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
            while (this.urls.size > URL_CACHE_SIZE) {
                this.urls.delete(this.urls.keys().next().value as string);
            }
        } catch (error) {
            batch.forEach(entry => entry.reject(error));
        }
    }

    async prefetchUrls(ids: readonly string[]): Promise<void> {
        const missing = Array.from(new Set(ids)).filter(id => {
            const cached = this.urls.get(id);
            return !cached || Date.now() - cached.resolvedAt >= URL_TTL_MS;
        });
        await Promise.all(missing.map(id => this.resolveUrl(id, false)));
    }
    private decode(data: Buffer, id: string, size: number | undefined, limit: number): Buffer {
        if (size !== undefined && size > limit) {
            throw new ProtocolError('The advertised blob size exceeds the supported limit.');
        }
        const hashOf = isNodeId(id) ? nodeIdOf : chunkIdOf;
        if (data.length <= limit && hashOf(data) === id) {
            if (size !== undefined && data.length !== size) {
                throw new IntegrityError('A blob does not match its advertised size.');
            }
            return data;
        }

        let decoded: Buffer;
        try {
            decoded = decompressChunk(data, { maxOutputSize: limit, expectedSize: size });
        } catch (error) {
            throw new IntegrityError(`A blob is neither valid raw data nor supported compressed content: ${(error as Error).message}`);
        }
        if (hashOf(decoded) !== id) {
            throw new IntegrityError('A blob does not match its content identifier.');
        }
        return decoded;
    }

    async getBlob(id: string, size: number | undefined, limit: number = MAX_CHUNK_BYTES): Promise<Buffer> {
        if (id === EMPTY_CHUNK_ID) {
            if (size !== undefined && size !== 0) {
                throw new IntegrityError('The empty chunk does not match its advertised size.');
            }
            return Buffer.alloc(0);
        }

        return this.gate.run(() => withRetry(async attempt => {
            const url = await this.resolveUrl(id, attempt > 0);
            let response;
            try {
                response = await this.http.request(url, {
                    authenticated: false,
                    headers: { 'Accept-Encoding': 'identity' },
                    maxResponseBytes: 2 * limit + 65536,
                    retries: 0,
                    signal: this.signal
                });
            } catch (error) {
                if (error instanceof HttpError && (error.status === 403 || error.status === 404 || error.status === 410)) {
                    // A queued signed URL may have expired; the next attempt resolves a fresh one.
                    this.logger.debug(`Blob URL for ${id.substring(0, 12)} was rejected (HTTP ${error.status}); resolving it again.`);
                }
                throw error;
            }
            return this.decode(response.body, id, size, limit);
        }, {
            retries: 4,
            baseDelayMs: 400,
            signal: this.signal,
            shouldRetry: error => error instanceof IntegrityError || isTransientError(error) || (error instanceof HttpError && (error.status === 403 || error.status === 404 || error.status === 410)),
            delayHint: error => error instanceof HttpError ? error.retryAfterMs : undefined,
            onRetry: (error, attempt, wait) => this.logger.debug(`Retrying blob ${id.substring(0, 12)} (attempt ${attempt + 1}) in ${wait}ms: ${(error as Error).message}`)
        }));
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
        const parts: Buffer[] = [];
        let total = 0;
        for (const leaf of leaves) {
            const data = await this.getBlob(leaf.id, leaf.size, MAX_CHUNK_BYTES);
            total += data.length;
            if (total > limit) {
                throw new ProtocolError('The blob exceeds the configured size limit.');
            }
            parts.push(data);
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
