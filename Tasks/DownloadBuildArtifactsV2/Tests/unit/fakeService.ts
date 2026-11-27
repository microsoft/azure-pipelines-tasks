import * as http from 'http';
import { AddressInfo } from 'net';

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
    /** Milliseconds that the service waits before it answers a request for a blob. */
    storageDelayMs = 0;
    baseUrl = '';
    private nextArtifactId = 1;
    private server!: http.Server;

    /** Adds an artifact to a build, like the build service does when an artifact is associated with it, and returns it with its id. */
    addArtifact(project: string, buildId: number, artifact: Record<string, unknown>): any {
        const key = `${project}/${buildId}`;
        const stored = { ...artifact, id: this.nextArtifactId++ };
        const list = this.artifacts.get(key) ?? [];
        list.push(stored);
        this.artifacts.set(key, list);
        return stored;
    }

    async start(): Promise<void> {
        this.server = http.createServer((req, res) => {
            const parts: Buffer[] = [];
            req.on('data', chunk => parts.push(chunk));
            req.on('end', () => {
                try {
                    this.handle(req, res, Buffer.concat(parts));
                } catch (error) {
                    console.error(error);
                    res.statusCode = 500;
                    res.end('The fake service failed; its error is in the test output.');
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
            this.json(res, { client: 'pipelineArtifact', properties: {} });
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
            const send = () => {
                const data = this.chunks.get(id) ?? this.nodes.get(id);
                if (!data) {
                    res.statusCode = 404;
                    res.end();
                } else {
                    res.setHeader('Content-Type', 'application/octet-stream');
                    res.end(data);
                }
            };
            if (this.storageDelayMs > 0) {
                setTimeout(send, this.storageDelayMs);
            } else {
                send();
            }
        } else if (/^\/(.+)\/_apis\/build\/builds\/(\d+)\/artifacts$/.test(path)) {
            this.artifactsRoute(path, res, url);
        } else {
            res.statusCode = 404;
            res.end('not found');
        }
    }

    private artifactsRoute(path: string, res: http.ServerResponse, url: URL): void {
        const match = /^\/(.+)\/_apis\/build\/builds\/(\d+)\/artifacts$/.exec(path)!;
        const key = `${decodeURIComponent(match[1])}/${match[2]}`;
        const list = this.artifacts.get(key) ?? [];
        if (url.searchParams.get('artifactName')) {
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
