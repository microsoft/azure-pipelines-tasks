import * as crypto from 'crypto';
import * as fs from 'fs';
import { HttpResponse } from '../http/httpClient';
import { ArtifactError, ProtocolError } from '../errors';
import { Logger, nullLogger } from '../util/logger';
import { Semaphore, forEachLimit, throwIfAborted } from '../util/concurrency';
import { DedupTransport, Receipt } from './blobStore';
import { BlobRef, chunkIdOf, isDedupId, isNodeId, normalizeDedupId } from './hashing';
import { PreparedArtifact, SourceChangedError } from './prepare';
import { NodeRecord } from './nodes';

const MAX_BATCH_CHUNKS = 64;
const MAX_BATCH_BYTES = 16 * 1024 * 1024;
const MAX_RECEIPT_SIGNATURE = 2048;
const NODE_FAN_OUT = 16;

export class UploadError extends ArtifactError { }

export interface UploadOptions {
    transport: DedupTransport;
    prepared: PreparedArtifact;
    logger?: Logger;
    signal?: AbortSignal;
    concurrency?: number;
    keepUntil?: Date;
}

export interface UploadStats {
    chunksUploaded: number;
    chunkBytes: number;
    nodeRequests: number;
}

function receiptsFromBody(body: Buffer, allowed: ReadonlySet<string>): Map<string, Receipt> {
    let parsed: unknown;
    try {
        parsed = JSON.parse(body.toString('utf8'));
    } catch {
        throw new ProtocolError('The dedup service returned invalid retention receipts.');
    }
    return receiptsFrom(parsed, allowed);
}

function receiptsFrom(parsed: unknown, allowed: ReadonlySet<string>): Map<string, Receipt> {
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new ProtocolError('The dedup service returned unexpected retention receipts.');
    }

    const entries = Object.entries(parsed as Record<string, unknown>);
    if (entries.length > allowed.size) {
        throw new ProtocolError('The dedup service returned an unexpected number of retention receipts.');
    }

    const result = new Map<string, Receipt>();
    for (const [key, value] of entries) {
        const id = normalizeDedupId(key, 'receipt identifier');
        if (!allowed.has(id) || result.has(id)) {
            throw new ProtocolError('The dedup service returned an unexpected or duplicate retention receipt.');
        }
        const item = value as { KeepUntil?: { KeepUntil?: unknown }; Signature?: unknown };
        const stamp = item?.KeepUntil?.KeepUntil;
        const signature = item?.Signature;
        if (typeof stamp !== 'string' || typeof signature !== 'string' || signature.length === 0 || signature.length > MAX_RECEIPT_SIGNATURE) {
            throw new ProtocolError('A retention receipt is malformed.');
        }
        const keepUntil = new Date(stamp);
        if (Number.isNaN(keepUntil.getTime())) {
            throw new ProtocolError('A retention receipt has an invalid expiry.');
        }
        const raw = Buffer.from(signature, 'base64');
        if (raw.length === 0) {
            throw new ProtocolError('A retention receipt has an empty signature.');
        }
        result.set(id, { keepUntil, keepUntilText: stamp, signature: raw });
    }
    return result;
}

/**
 * Uploads a prepared artifact. The tree is walked top down: a node is offered to the service, the service
 * answers with the children it does not have (HTTP 409), only those chunks and nodes are uploaded, and the
 * node is offered again together with the retention receipts of its children.
 */
export class DedupUploader {
    private readonly transport: DedupTransport;
    private readonly prepared: PreparedArtifact;
    private readonly logger: Logger;
    private readonly signal?: AbortSignal;
    private readonly keepUntil: Date;
    private readonly known = new Map<string, Receipt>();
    private readonly chunkGate: Semaphore;
    private readonly nodeGate: Semaphore;
    private readonly inflight = new Map<string, Promise<void>>();
    private readonly maxBatchChunks: number;
    private readonly batchParallelism: number;
    private chunksUploaded = 0;
    private chunkBytes = 0;
    private nodeRequests = 0;
    private lastReport = Date.now();

    constructor(options: UploadOptions) {
        this.transport = options.transport;
        this.prepared = options.prepared;
        this.logger = options.logger ?? nullLogger;
        this.signal = options.signal;
        this.keepUntil = options.keepUntil ?? new Date(Math.floor(Date.now() / 1000) * 1000 + 2 * 24 * 60 * 60 * 1000);
        this.batchParallelism = Math.max(1, options.concurrency ?? 16);
        this.chunkGate = new Semaphore(this.batchParallelism);
        this.nodeGate = new Semaphore(Math.max(4, Math.min(64, (options.concurrency ?? 16) * 2)));
        this.maxBatchChunks = options.prepared.hashType === 'Dedup1024K' ? 10 : MAX_BATCH_CHUNKS;
    }

    private ready(id: string): boolean {
        const receipt = this.known.get(id);
        return receipt !== undefined && receipt.keepUntil.getTime() >= this.keepUntil.getTime() && receipt.keepUntil.getTime() > Date.now();
    }

    private remember(found: Map<string, Receipt>): void {
        for (const [id, receipt] of found) {
            const current = this.known.get(id);
            if (!current || receipt.keepUntil.getTime() >= current.keepUntil.getTime()) {
                this.known.set(id, receipt);
            }
        }
    }

    private chunkSize(id: string): number {
        const inline = this.prepared.inlineChunks.get(id);
        if (inline) {
            return inline.length;
        }
        const location = this.prepared.chunks.get(id);
        if (!location) {
            throw new UploadError(`The service asked for an unknown chunk (${id}).`);
        }
        return location.size;
    }

    private async readChunk(id: string): Promise<Buffer> {
        const inline = this.prepared.inlineChunks.get(id);
        if (inline) {
            return inline;
        }

        const location = this.prepared.chunks.get(id);
        if (!location) {
            throw new UploadError(`The service asked for an unknown chunk (${id}).`);
        }

        const handle = await fs.promises.open(location.file.absolutePath, 'r');
        try {
            const data = Buffer.allocUnsafe(location.size);
            let read = 0;
            while (read < location.size) {
                const { bytesRead } = await handle.read(data, read, location.size - read, location.offset + read);
                if (bytesRead === 0) {
                    break;
                }
                read += bytesRead;
            }
            if (read !== location.size || chunkIdOf(data) !== id) {
                throw new SourceChangedError(`The file '${location.file.relativePath}' changed while it was being uploaded.`);
            }
            return data;
        } finally {
            await handle.close();
        }
    }

    private summaryHeaders(children: readonly BlobRef[]): Record<string, string> {
        // The service verifies the retention of all children with an ordered digest of their receipt signatures.
        const digest = crypto.createHash('sha256');
        const dates: string[] = [];
        for (const child of children) {
            const receipt = this.known.get(child.id)!;
            digest.update(receipt.signature);
            dates.push(receipt.keepUntilText);
        }
        return { 'X-MS-KeepUntils': dates.join(','), 'X-MS-Signature': digest.digest('base64') };
    }

    private async uploadBatch(ids: readonly string[]): Promise<void> {
        await this.chunkGate.run(async () => {
            throwIfAborted(this.signal);
            const parts: Buffer[] = [];
            const lengths: Array<{ id: string; length: number }> = [];
            for (const id of ids) {
                const data = await this.readChunk(id);
                parts.push(data);
                lengths.push({ id, length: data.length });
            }
            const body = parts.length === 1 ? parts[0] : Buffer.concat(parts);
            const response = await this.transport.putChunks(body, lengths, this.keepUntil, this.signal);
            if (response.status !== 200) {
                throw new UploadError('Chunk upload was not acknowledged by the service.');
            }
            const found = receiptsFromBody(response.body, new Set(ids));
            for (const id of ids) {
                const receipt = found.get(id);
                if (!receipt || receipt.keepUntil.getTime() < this.keepUntil.getTime()) {
                    throw new UploadError('The service did not retain an uploaded chunk for the requested time.');
                }
            }
            this.remember(found);
            this.chunksUploaded += ids.length;
            this.chunkBytes += body.length;
            if (Date.now() - this.lastReport > 15000) {
                this.lastReport = Date.now();
                this.logger.info(`Uploaded ${this.chunksUploaded} chunk(s), ${this.chunkBytes} bytes so far.`);
            }
        });
    }

    private async uploadChunks(ids: readonly string[]): Promise<void> {
        const pending = ids.filter(id => !this.ready(id));
        const batches: string[][] = [];
        let current: string[] = [];
        let bytes = 0;
        for (const id of pending) {
            const size = this.chunkSize(id);
            if (current.length > 0 && (current.length >= this.maxBatchChunks || bytes + size > MAX_BATCH_BYTES)) {
                batches.push(current);
                current = [];
                bytes = 0;
            }
            current.push(id);
            bytes += size;
        }
        if (current.length > 0) {
            batches.push(current);
        }
        await forEachLimit(batches, this.batchParallelism, batch => this.uploadBatch(batch), this.signal);
    }

    private async offerNode(node: NodeRecord): Promise<{ response: HttpResponse; hadProof: boolean }> {
        const hadProof = node.children.every(child => this.ready(child.id));
        const response = await this.nodeGate.run(async () => {
            throwIfAborted(this.signal);
            this.nodeRequests++;
            return this.transport.putNode(node.ref.id, node.data, this.keepUntil, hadProof ? this.summaryHeaders(node.children) : {}, this.signal);
        });
        return { response, hadProof };
    }

    private acknowledge(node: NodeRecord, response: HttpResponse): void {
        if (response.status !== 200) {
            throw new UploadError('Node retention was not completed by the service.');
        }
        const allowed = new Set<string>([node.ref.id, ...node.children.map(child => child.id)]);
        const found = receiptsFromBody(response.body, allowed);
        const own = found.get(node.ref.id);
        if (!own || own.keepUntil.getTime() < this.keepUntil.getTime() || own.keepUntil.getTime() <= Date.now()) {
            throw new UploadError('The retention receipt of a node is missing or expired.');
        }
        // An existing node can also return the receipts of its immediate children.
        this.remember(found);
    }

    private ensureNode(id: string): Promise<void> {
        if (this.ready(id)) {
            return Promise.resolve();
        }
        let running = this.inflight.get(id);
        if (!running) {
            running = this.negotiateNode(id).finally(() => this.inflight.delete(id));
            this.inflight.set(id, running);
        }
        return running;
    }

    private async negotiateNode(id: string): Promise<void> {
        const node = this.prepared.nodes.get(id);
        if (!node) {
            throw new UploadError(`The service asked for an unknown node (${id}).`);
        }

        const first = await this.offerNode(node);
        if (first.response.status === 200) {
            this.acknowledge(node, first.response);
            return;
        }
        if (first.response.status !== 409) {
            throw new UploadError('Node upload was not acknowledged by the service.');
        }
        if (first.hadProof) {
            throw new UploadError('The service rejected a complete retention proof.');
        }

        let negotiation: { Missing?: unknown; InsufficientKeepUntil?: unknown; Receipts?: unknown };
        try {
            negotiation = JSON.parse(first.response.body.toString('utf8'));
        } catch {
            throw new ProtocolError('The dedup service returned an invalid node negotiation response.');
        }

        const childIds = new Set(node.children.map(child => child.id));
        const required = new Set<string>();
        for (const field of [negotiation.Missing, negotiation.InsufficientKeepUntil]) {
            if (field === undefined || field === null) {
                continue;
            }
            if (!Array.isArray(field)) {
                throw new ProtocolError('The dedup service returned an invalid node negotiation response.');
            }
            for (const value of field) {
                if (!isDedupId(value) || !childIds.has(value.toUpperCase())) {
                    throw new ProtocolError('The dedup service asked for an unknown child of a node.');
                }
                required.add(value.toUpperCase());
            }
        }
        if (negotiation.Receipts && typeof negotiation.Receipts === 'object') {
            this.remember(receiptsFrom(negotiation.Receipts, childIds));
        }

        const gainedProof = node.children.every(child => this.ready(child.id));
        if ((required.size === 0 && !gainedProof) || node.children.some(child => !required.has(child.id) && !this.ready(child.id))) {
            throw new UploadError('The service did not account for the retention of all children of a node.');
        }

        const nodes = [...required].filter(isNodeId);
        const chunks = [...required].filter(child => !isNodeId(child));
        await Promise.all([forEachLimit(nodes, NODE_FAN_OUT, child => this.ensureNode(child), this.signal), this.uploadChunks(chunks)]);

        if (!node.children.every(child => this.ready(child.id))) {
            throw new UploadError('The retention of the children of a node is incomplete.');
        }
        const second = await this.offerNode(node);
        this.acknowledge(node, second.response);
    }

    async upload(): Promise<UploadStats> {
        const root = this.prepared.superRoot.id;
        this.logger.info(`Uploading artifact content (${this.prepared.nodes.size} node(s), ${this.prepared.chunks.size} chunk(s)) to ${this.transport.describe()}`);
        await this.ensureNode(root);
        if (!this.ready(root)) {
            throw new UploadError('The retention of the artifact root is incomplete.');
        }
        this.logger.info(`Uploaded ${this.chunksUploaded} chunk(s), ${this.chunkBytes} bytes.`);
        return { chunksUploaded: this.chunksUploaded, chunkBytes: this.chunkBytes, nodeRequests: this.nodeRequests };
    }
}
