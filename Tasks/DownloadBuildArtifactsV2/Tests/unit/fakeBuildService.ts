import * as http from 'http';
import { AddressInfo } from 'net';
import { RecordedRequest } from './fakeService';

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

/** The projects, pipeline definitions and builds of a fake organization, as far as the selection of a build needs them. */
export class FakeBuildService {
    readonly requests: RecordedRequest[] = [];
    fault: ((request: RecordedRequest) => number | undefined) | undefined;
    baseUrl = '';
    readonly projects: FakeProject[] = [];
    readonly definitions: FakeDefinition[] = [];
    readonly builds: FakeBuild[] = [];

    private httpServer!: http.Server;

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
                    console.error(error);
                    res.statusCode = 500;
                    res.end('The fake service failed; its error is in the test output.');
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
}
