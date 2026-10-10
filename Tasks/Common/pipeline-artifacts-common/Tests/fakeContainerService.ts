import * as http from 'http';
import { AddressInfo } from 'net';
import { URL } from 'url';
import { chunkIdOf } from '../src/dedup/hashing';
import { FakeService, RecordedRequest } from './fakeService';

export interface ContainerItemDefinition {
    path: string;
    itemType: 'file' | 'folder';
    fileLength?: number;
    contentLocation?: string;
    itemLocation?: string;
    blobMetadata?: { artifactHash: string; compressionType?: string };
}

interface StoredContent {
    body: Buffer;
    contentType: string;
    contentEncoding?: string;
}

export class FakeContainerService {
    readonly blob = new FakeService();
    readonly requests: RecordedRequest[] = [];
    baseUrl = '';
    fault: ((request: RecordedRequest) => number | undefined) | undefined;

    private readonly containers = new Map<number, ContainerItemDefinition[]>();
    private readonly contents = new Map<string, StoredContent>();
    private server!: http.Server;

    async start(): Promise<void> {
        await this.blob.start();
        this.server = http.createServer((req, res) => {
            const parts: Buffer[] = [];
            req.on('data', chunk => parts.push(chunk));
            req.on('end', () => {
                const body = Buffer.concat(parts);
                void this.handle(req, res, body).catch(error => {
                    res.statusCode = 500;
                    res.end(String(error));
                });
            });
        });
        await new Promise<void>(resolve => this.server.listen(0, '127.0.0.1', resolve));
        this.baseUrl = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
    }

    async stop(): Promise<void> {
        await new Promise<void>(resolve => this.server.close(() => resolve()));
        await this.blob.stop();
    }

    countRequests(method: string, pathPart: string): number {
        return this.requests.filter(request => request.method === method && request.path.includes(pathPart)).length;
    }

    setContainer(containerId: number, items: ContainerItemDefinition[]): void {
        this.containers.set(containerId, items.map(item => ({ ...item })));
    }

    addContent(name: string, body: Buffer | string, contentType = 'application/octet-stream', contentEncoding?: string): string {
        const key = name.replace(/^\/+/, '');
        this.contents.set(key, { body: typeof body === 'string' ? Buffer.from(body, 'utf8') : body, contentType, contentEncoding });
        return `${this.baseUrl}/container-content/${encodeURIComponent(key)}`;
    }

    addDedupBlob(body: Buffer, compressionType?: string, domainId = '0'): { artifactHash: string; compressionType?: string } {
        const id = chunkIdOf(body);
        this.blob.chunks.set(id, Buffer.from(body));
        return { artifactHash: domainId === '0' ? id : `${domainId},${id}`, compressionType };
    }

    private async handle(req: http.IncomingMessage, res: http.ServerResponse, body: Buffer): Promise<void> {
        const url = new URL(req.url ?? '/', this.baseUrl);
        const recorded: RecordedRequest = { method: req.method ?? 'GET', path: url.pathname, headers: req.headers, body };
        this.requests.push(recorded);

        const injected = this.fault?.(recorded);
        if (injected !== undefined) {
            res.statusCode = injected;
            res.end('injected failure');
            return;
        }

        const match = /^\/_apis\/resources\/Containers\/(\d+)$/.exec(url.pathname);
        if (req.method === 'GET' && match) {
            const containerId = Number(match[1]);
            const items = this.containers.get(containerId) ?? [];
            this.json(res, { count: items.length, value: items });
            return;
        }

        if (req.method === 'GET' && url.pathname.startsWith('/container-content/')) {
            const key = decodeURIComponent(url.pathname.substring('/container-content/'.length));
            const content = this.contents.get(key);
            if (!content) {
                res.statusCode = 404;
                res.end();
                return;
            }
            res.setHeader('Content-Type', content.contentType);
            if (content.contentEncoding) {
                res.setHeader('Content-Encoding', content.contentEncoding);
            }
            res.end(content.body);
            return;
        }

        if (req.method === 'GET' && url.pathname.startsWith('/_apis/ResourceAreas/')) {
            this.json(res, { id: url.pathname.split('/').pop(), name: 'dedup', locationUrl: `${this.baseUrl}/vsblob/` });
            return;
        }

        if (req.method === 'GET' && url.pathname === '/vsblob/_apis/clienttools/BuildArtifact/settings') {
            this.json(res, { client: 'BuildArtifact', properties: { ChunkSize: 'Dedup1024k', DefaultDomainId: '0' } });
            return;
        }

        await this.proxyToBlob(req, res, body, url);
    }

    private async proxyToBlob(req: http.IncomingMessage, res: http.ServerResponse, body: Buffer, url: URL): Promise<void> {
        const target = new URL(this.blob.baseUrl + url.pathname + url.search);
        await new Promise<void>((resolve, reject) => {
            const request = http.request({
                hostname: target.hostname,
                port: target.port,
                path: target.pathname + target.search,
                method: req.method,
                headers: req.headers
            }, response => {
                res.statusCode = response.statusCode ?? 500;
                for (const [name, value] of Object.entries(response.headers)) {
                    if (value !== undefined) {
                        res.setHeader(name, value as string | string[]);
                    }
                }
                response.on('error', reject);
                response.pipe(res);
                response.on('end', () => resolve());
            });
            request.on('error', reject);
            request.end(body);
        });
    }

    private json(res: http.ServerResponse, value: unknown, status = 200): void {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(value));
    }
}
