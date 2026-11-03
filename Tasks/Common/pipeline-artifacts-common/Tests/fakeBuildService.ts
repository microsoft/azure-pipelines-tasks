import * as crypto from 'crypto';
import * as http from 'http';
import { AddressInfo } from 'net';
import { chunkIdOf, nodeIdOf } from '../src/dedup/hashing';
import { parseNode } from '../src/dedup/nodes';
import { FakeServiceOptions, RecordedRequest } from './fakeService';

export interface FakeProject {
    id: string;
    name: string;
}

export interface FakeDefinition {
    id: number;
    name: string;
    project: string;
}

export interface FakeBuild {
    id: number;
    buildNumber?: string;
    status?: string;
    result?: string;
    sourceBranch?: string;
    definition: { id: number; name?: string };
    project: { id: string; name?: string };
    finishTime?: string;
    tags?: string[];
}

function trimSlashes(value: string): string {
    return value.replace(/^\/+|\/+$/g, '');
}

function decodePathSegment(value: string): string {
    return decodeURIComponent(trimSlashes(value));
}

function equalsIgnoreCase(left: string | undefined, right: string | undefined): boolean {
    return !!left && !!right && left.localeCompare(right, undefined, { sensitivity: 'accent' }) === 0;
}

function buildResultFlag(result: string | undefined): number {
    switch ((result ?? '').toLowerCase()) {
        case 'succeeded':
            return 2;
        case 'partiallysucceeded':
            return 4;
        case 'failed':
            return 8;
        case 'canceled':
            return 32;
        default:
            return 0;
    }
}

export class FakeBuildService {
    readonly chunks = new Map<string, Buffer>();
    readonly nodes = new Map<string, Buffer>();
    readonly artifacts = new Map<string, any[]>();
    readonly requests: RecordedRequest[] = [];
    fault: ((request: RecordedRequest) => number | undefined) | undefined;
    baseUrl = '';
    readonly projects: FakeProject[] = [];
    readonly definitions: FakeDefinition[] = [];
    readonly builds: FakeBuild[] = [];

    private artifactIdCounter = 1;
    private httpServer!: http.Server;

    constructor(private readonly options: FakeServiceOptions = {}) {
    }

    addProject(project: FakeProject): void {
        this.projects.push(project);
    }

    addDefinition(definition: FakeDefinition): void {
        this.definitions.push(definition);
    }

    addBuild(build: FakeBuild): void {
        this.builds.push(build);
    }

    async start(): Promise<void> {
        this.httpServer = http.createServer((req, res) => {
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
        await new Promise<void>(resolve => this.httpServer.listen(0, '127.0.0.1', resolve));
        this.baseUrl = `http://127.0.0.1:${(this.httpServer.address() as AddressInfo).port}`;
    }

    async stop(): Promise<void> {
        await new Promise<void>(resolve => this.httpServer.close(() => resolve()));
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

    private resolveProject(projectNameOrId: string): FakeProject | undefined {
        const decoded = decodePathSegment(projectNameOrId);
        return this.projects.find(project => equalsIgnoreCase(project.id, decoded) || equalsIgnoreCase(project.name, decoded));
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

        const route = url.pathname;
        if (req.method === 'GET' && route.startsWith('/_apis/ResourceAreas/')) {
            this.json(res, { id: route.split('/').pop(), name: 'dedup', locationUrl: `${this.baseUrl}/vsblob/` });
            return;
        }
        if (req.method === 'GET' && route === '/vsblob/_apis/clienttools/PipelineArtifact/settings') {
            this.json(res, { client: 'pipelineArtifact', properties: { ChunkSize: this.options.chunkSize ?? 'Dedup1024k', ...(this.options.settings ?? {}) } });
            return;
        }
        if (req.method === 'POST' && route.endsWith('/_apis/dedup/urls')) {
            const ids = JSON.parse(body.toString('utf8')) as string[];
            const result: Record<string, string> = {};
            for (const id of ids) {
                if (this.has(id)) {
                    result[id] = `${this.baseUrl}/storage/${id}`;
                }
            }
            this.json(res, result);
            return;
        }
        if (req.method === 'GET' && route.startsWith('/storage/')) {
            const id = route.substring('/storage/'.length);
            const data = this.chunks.get(id) ?? this.nodes.get(id);
            if (!data) {
                res.statusCode = 404;
                res.end();
            } else {
                res.setHeader('Content-Type', 'application/octet-stream');
                res.end(data);
            }
            return;
        }
        if (req.method === 'PUT' && route.endsWith('/_apis/dedup/chunks')) {
            this.putChunks(req, res, body);
            return;
        }
        if (req.method === 'PUT' && /\/_apis\/dedup\/nodes\/[0-9A-F]{66}$/i.test(route)) {
            this.putNode(route.split('/').pop()!, req, res, body);
            return;
        }
        if (req.method === 'GET' && route.startsWith('/_apis/projects/')) {
            this.projectRoute(route, res);
            return;
        }
        if (req.method === 'GET' && /\/_apis\/build\/definitions$/i.test(route)) {
            this.definitionsRoute(route, url, res);
            return;
        }
        if (req.method === 'GET' && /\/_apis\/build\/builds$/i.test(route)) {
            this.buildsRoute(route, url, res);
            return;
        }
        if (/^\/(.+)\/_apis\/build\/builds\/(\d+)\/artifacts$/i.test(route)) {
            this.artifactsRoute(route, req, res, url, body);
            return;
        }

        res.statusCode = 404;
        res.end('not found');
    }

    private projectRoute(route: string, res: http.ServerResponse): void {
        const project = this.resolveProject(route.substring('/_apis/projects/'.length));
        if (!project) {
            res.statusCode = 404;
            res.end('project not found');
            return;
        }
        this.json(res, project);
    }

    private definitionsRoute(route: string, url: URL, res: http.ServerResponse): void {
        const match = /^\/(.+)\/_apis\/build\/definitions$/i.exec(route)!;
        const project = this.resolveProject(match[1]);
        if (!project) {
            res.statusCode = 404;
            res.end('project not found');
            return;
        }
        const name = url.searchParams.get('name');
        const definitions = this.definitions.filter(definition => definition.project === project.id && (!name || definition.name === name));
        this.json(res, { count: definitions.length, value: definitions.map(definition => ({ id: definition.id, name: definition.name })) });
    }

    private buildsRoute(route: string, url: URL, res: http.ServerResponse): void {
        const match = /^\/(.+)\/_apis\/build\/builds$/i.exec(route)!;
        const project = this.resolveProject(match[1]);
        if (!project) {
            res.statusCode = 404;
            res.end('project not found');
            return;
        }

        const definitionIds = (url.searchParams.get('definitions') ?? '').split(',').filter(Boolean).map(value => Number(value));
        const branchName = url.searchParams.get('branchName') ?? undefined;
        const resultFilter = Number(url.searchParams.get('resultFilter') ?? '0');
        const queryOrder = url.searchParams.get('queryOrder') ?? undefined;
        const top = Number(url.searchParams.get('$top') ?? '0');
        const tagFilters = (url.searchParams.get('tagFilters') ?? '').split(',').map(value => value.trim()).filter(Boolean);
        const statusFilter = (url.searchParams.get('statusFilter') ?? '').toLowerCase();

        let builds = this.builds.filter(build => build.project.id === project.id);
        if (definitionIds.length > 0) {
            builds = builds.filter(build => definitionIds.includes(build.definition.id));
        }
        if (branchName) {
            builds = builds.filter(build => build.sourceBranch === branchName);
        }
        if (tagFilters.length > 0) {
            builds = builds.filter(build => tagFilters.every(tag => (build.tags ?? []).includes(tag)));
        }
        if (resultFilter) {
            builds = builds.filter(build => (buildResultFlag(build.result) & resultFilter) !== 0);
        }
        if (statusFilter) {
            builds = builds.filter(build => (build.status ?? '').toLowerCase() === statusFilter);
        }
        if ((queryOrder ?? '').toLowerCase() === 'finishtimedescending') {
            builds = [...builds].sort((left, right) => {
                const leftTime = new Date(left.finishTime ?? 0).getTime();
                const rightTime = new Date(right.finishTime ?? 0).getTime();
                return rightTime - leftTime;
            });
        }
        if (top > 0) {
            builds = builds.slice(0, top);
        }

        this.json(res, { count: builds.length, value: builds });
    }

    private putChunks(req: http.IncomingMessage, res: http.ServerResponse, body: Buffer): void {
        const found: Array<{ id: string; length: number }> = [];
        for (const [name, value] of Object.entries(req.headers)) {
            const match = /^x-ms-chunk-([0-9a-f]{66})$/i.exec(name);
            if (match) {
                found.push({ id: match[1].toUpperCase(), length: Number(String(value).split('/')[0]) });
            }
        }
        let offset = 0;
        const receipts: Record<string, unknown> = {};
        const remaining = [...found];
        const assigned: Array<{ id: string; data: Buffer }> = [];
        while (offset < body.length && remaining.length > 0) {
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

    private artifactsRoute(route: string, req: http.IncomingMessage, res: http.ServerResponse, url: URL, body: Buffer): void {
        const match = /^\/(.+)\/_apis\/build\/builds\/(\d+)\/artifacts$/i.exec(route)!;
        const key = `${decodeURIComponent(match[1])}/${match[2]}`;
        const list = this.artifacts.get(key) ?? [];
        if (req.method === 'POST') {
            const artifact = JSON.parse(body.toString('utf8'));
            artifact.id = this.artifactIdCounter++;
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
