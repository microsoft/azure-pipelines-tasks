import * as crypto from 'crypto';
import * as http from 'http';
import { AddressInfo } from 'net';
import { chunkIdOf, nodeIdOf } from '../src/dedup/hashing';
import { parseNode } from '../src/dedup/nodes';

export interface FakeServiceOptions {
    chunkSize?: string;
    settings?: Record<string, string>;
}

export interface RecordedRequest {
    method: string;
    path: string;
    headers: http.IncomingHttpHeaders;
    body: Buffer;
}

export class FakeService {
    readonly chunks = new Map<string, Buffer>();
    readonly nodes = new Map<string, Buffer>();
    readonly artifacts = new Map<string, any[]>();
    readonly requests: RecordedRequest[] = [];
    fault: ((request: RecordedRequest) => number | undefined) | undefined;
    baseUrl = '';
    private nextArtifactId = 1;
    private server!: http.Server;

    constructor(private readonly options: FakeServiceOptions = {}) { }

    async start(): Promise<void> {
        this.server = http.createServer((req, res) => {
            const parts: Buffer[] = [];
            req.on('data', chunk => parts.push(chunk));
            req.on('end', () => {
                try {
                    this.handle(req, res, Buffer.concat(parts));
                } catch (error) {
                    res.statusCode = 500;
                    res.end(String(error));
                }
            });
        });
        await new Promise<void>(resolve => this.server.listen(0, '127.0.0.1', resolve));
        this.baseUrl = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
    }

    async stop(): Promise<void> {
        await new Promise<void>(resolve => this.server.close(() => resolve()));
    }

    countRequests(method: string, pathPart: string): number {
        return this.requests.filter(request => request.method === method && request.path.includes(pathPart)).length;
    }

    private json(res: http.ServerResponse, value: unknown, status = 200): void {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(value));
    }

    private receipt(id: string): Record<string, unknown> {
        const keepUntil = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
        return {
            [id]: {
                Signature: crypto.createHash('sha256').update(id).digest('base64'),
                KeepUntil: { KeepUntil: keepUntil }
            }
        };
    }

    private has(id: string): boolean {
        return this.chunks.has(id) || this.nodes.has(id);
    }

    private handle(req: http.IncomingMessage, res: http.ServerResponse, body: Buffer): void {
        const url = new URL(req.url ?? '/', this.baseUrl);
        const recorded: RecordedRequest = { method: req.method ?? 'GET', path: url.pathname, headers: req.headers, body };
        this.requests.push(recorded);

        const injected = this.fault?.(recorded);
        if (injected !== undefined) {
            res.statusCode = injected;
            res.end('injected failure');
            return;
        }

        const path = url.pathname;
        if (req.method === 'GET' && path.startsWith('/_apis/ResourceAreas/')) {
            this.json(res, { id: path.split('/').pop(), name: 'dedup', locationUrl: `${this.baseUrl}/vsblob/` });
        } else if (req.method === 'GET' && path === '/vsblob/_apis/clienttools/PipelineArtifact/settings') {
            this.json(res, { client: 'pipelineArtifact', properties: { ChunkSize: this.options.chunkSize ?? 'Dedup1024k', ...this.options.settings } });
        } else if (req.method === 'POST' && path.endsWith('/_apis/dedup/urls')) {
            const ids = JSON.parse(body.toString('utf8')) as string[];
            const result: Record<string, string> = {};
            for (const id of ids) {
                if (this.has(id)) {
                    result[id] = `${this.baseUrl}/storage/${id}`;
                }
            }
            this.json(res, result);
        } else if (req.method === 'GET' && path.startsWith('/storage/')) {
            const id = path.substring('/storage/'.length);
            const data = this.chunks.get(id) ?? this.nodes.get(id);
            if (!data) {
                res.statusCode = 404;
                res.end();
            } else {
                res.setHeader('Content-Type', 'application/octet-stream');
                res.end(data);
            }
        } else if (req.method === 'PUT' && path.endsWith('/_apis/dedup/chunks')) {
            this.putChunks(req, res, body);
        } else if (req.method === 'PUT' && /\/_apis\/dedup\/nodes\/[0-9A-F]{66}$/.test(path)) {
            this.putNode(path.split('/').pop()!, req, res, body);
        } else if (/^\/(.+)\/_apis\/build\/builds\/(\d+)\/artifacts$/.test(path)) {
            this.artifactsRoute(path, req, res, url, body);
        } else {
            res.statusCode = 404;
            res.end('not found');
        }
    }

    private putChunks(req: http.IncomingMessage, res: http.ServerResponse, body: Buffer): void {
        const found: Array<{ id: string; length: number }> = [];
        for (const [name, value] of Object.entries(req.headers)) {
            const match = /^x-ms-chunk-([0-9a-f]{66})$/i.exec(name);
            if (match) {
                found.push({ id: match[1].toUpperCase(), length: Number(String(value).split('/')[0]) });
            }
        }
        // Header order is not guaranteed by Node; the chunk order is the order of the identifiers in the body.
        let offset = 0;
        const receipts: Record<string, unknown> = {};
        const remaining = [...found];
        const assigned: Array<{ id: string; data: Buffer }> = [];
        while (remaining.length > 0) {
            const index = remaining.findIndex(entry => chunkIdOf(body.subarray(offset, offset + entry.length)) === entry.id);
            if (index < 0) {
                res.statusCode = 400;
                res.end('chunk does not match any identifier');
                return;
            }
            const [entry] = remaining.splice(index, 1);
            assigned.push({ id: entry.id, data: Buffer.from(body.subarray(offset, offset + entry.length)) });
            offset += entry.length;
        }
        if (offset !== body.length || remaining.length > 0) {
            res.statusCode = 400;
            res.end('chunk body does not match the headers');
            return;
        }
        for (const entry of assigned) {
            this.chunks.set(entry.id, entry.data);
            Object.assign(receipts, this.receipt(entry.id));
        }
        this.json(res, receipts);
    }

    private putNode(id: string, req: http.IncomingMessage, res: http.ServerResponse, body: Buffer): void {
        if (nodeIdOf(body) !== id) {
            res.statusCode = 400;
            res.end('node does not match its identifier');
            return;
        }
        const children = parseNode(body);
        const missing = children.filter(child => !this.has(child.id)).map(child => child.id);
        const hasProof = typeof req.headers['x-ms-signature'] === 'string' && typeof req.headers['x-ms-keepuntils'] === 'string';
        if (missing.length > 0 && !hasProof) {
            const receipts: Record<string, unknown> = {};
            for (const child of children) {
                if (!missing.includes(child.id)) {
                    Object.assign(receipts, this.receipt(child.id));
                }
            }
            this.json(res, { Missing: missing, InsufficientKeepUntil: [], Receipts: receipts }, 409);
            return;
        }
        this.nodes.set(id, Buffer.from(body));
        const receipts: Record<string, unknown> = this.receipt(id);
        for (const child of children) {
            if (this.has(child.id)) {
                Object.assign(receipts, this.receipt(child.id));
            }
        }
        this.json(res, receipts);
    }

    private artifactsRoute(path: string, req: http.IncomingMessage, res: http.ServerResponse, url: URL, body: Buffer): void {
        const match = /^\/(.+)\/_apis\/build\/builds\/(\d+)\/artifacts$/.exec(path)!;
        const key = `${decodeURIComponent(match[1])}/${match[2]}`;
        const list = this.artifacts.get(key) ?? [];
        if (req.method === 'POST') {
            const artifact = JSON.parse(body.toString('utf8'));
            artifact.id = this.nextArtifactId++;
            list.push(artifact);
            this.artifacts.set(key, list);
            this.json(res, artifact);
        } else if (url.searchParams.get('artifactName')) {
            const artifact = list.find(candidate => candidate.name === url.searchParams.get('artifactName'));
            if (artifact) {
                this.json(res, artifact);
            } else {
                res.statusCode = 404;
                res.end('{"message":"Artifact not found"}');
            }
        } else {
            this.json(res, { count: list.length, value: list });
        }
    }
}
