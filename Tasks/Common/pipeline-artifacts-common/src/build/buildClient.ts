import { HttpClient } from '../http/httpClient';
import { ArtifactError, HttpError } from '../errors';

const BUILD_API_VERSION = '7.1';

export interface ArtifactResource {
    type: string;
    data: string;
    properties?: Record<string, string>;
    url?: string;
    downloadUrl?: string;
}

export interface BuildArtifact {
    id?: number;
    name: string;
    source?: string;
    resource: ArtifactResource;
}

export interface BuildReference {
    id: number;
    buildNumber?: string;
    status?: string;
    result?: string;
    sourceBranch?: string;
    definition?: { id: number; name?: string };
    project?: { id: string; name?: string };
    finishTime?: string;
}

export interface DefinitionReference {
    id: number;
    name?: string;
}

export const BuildResult = {
    None: 0,
    Succeeded: 2,
    PartiallySucceeded: 4,
    Failed: 8,
    Canceled: 32
} as const;

export class ArtifactNotFoundError extends ArtifactError { }

function trimSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

interface ListResponse<T> {
    count?: number;
    value?: T[];
}

export class BuildClient {
    private readonly root: string;

    constructor(private readonly http: HttpClient, collectionUri: string) {
        this.root = trimSlash(collectionUri);
    }

    private buildUrl(project: string, ...segments: string[]): string {
        return [this.root, encodeURIComponent(project), '_apis', 'build', ...segments].join('/');
    }

    async getArtifact(project: string, buildId: number, name: string, signal?: AbortSignal): Promise<BuildArtifact> {
        try {
            return await this.http.json<BuildArtifact>(this.buildUrl(project, 'builds', String(buildId), 'artifacts'), {
                query: { artifactName: name, 'api-version': BUILD_API_VERSION },
                retries: 3,
                signal
            });
        } catch (error) {
            if (error instanceof HttpError && error.status === 404) {
                throw new ArtifactNotFoundError(`The artifact '${name}' of build ${buildId} was not found: ${error.message}`);
            }
            throw error;
        }
    }

    async getArtifacts(project: string, buildId: number, signal?: AbortSignal): Promise<BuildArtifact[]> {
        const response = await this.http.json<ListResponse<BuildArtifact>>(this.buildUrl(project, 'builds', String(buildId), 'artifacts'), {
            query: { 'api-version': BUILD_API_VERSION },
            retries: 3,
            signal
        });
        return response.value ?? [];
    }

    async getBuild(project: string, buildId: number, signal?: AbortSignal): Promise<BuildReference> {
        return this.http.json<BuildReference>(this.buildUrl(project, 'builds', String(buildId)), {
            query: { 'api-version': BUILD_API_VERSION },
            retries: 3,
            signal
        });
    }

    async createArtifact(projectId: string, buildId: number, artifact: BuildArtifact, timeoutMs: number, signal?: AbortSignal): Promise<BuildArtifact> {
        return this.http.json<BuildArtifact>(this.buildUrl(projectId, 'builds', String(buildId), 'artifacts'), {
            method: 'POST',
            query: { 'api-version': BUILD_API_VERSION },
            headers: { 'Content-Type': 'application/json; charset=utf-8; api-version=' + BUILD_API_VERSION },
            body: JSON.stringify(artifact),
            timeoutMs,
            retries: 3,
            signal
        });
    }

    async getDefinitionsByName(project: string, name: string, signal?: AbortSignal): Promise<DefinitionReference[]> {
        const response = await this.http.json<ListResponse<DefinitionReference>>(this.buildUrl(project, 'definitions'), {
            query: { name, 'api-version': BUILD_API_VERSION },
            retries: 3,
            signal
        });
        return response.value ?? [];
    }

    async getBuilds(project: string, query: {
        definitions?: number[];
        branchName?: string;
        tagFilters?: string[];
        resultFilter?: number;
        statusFilter?: string;
        queryOrder?: string;
        top?: number;
    }, signal?: AbortSignal): Promise<BuildReference[]> {
        const response = await this.http.json<ListResponse<BuildReference>>(this.buildUrl(project, 'builds'), {
            query: {
                definitions: query.definitions?.join(','),
                branchName: query.branchName || undefined,
                tagFilters: query.tagFilters && query.tagFilters.length ? query.tagFilters.join(',') : undefined,
                resultFilter: query.resultFilter,
                statusFilter: query.statusFilter,
                queryOrder: query.queryOrder,
                '$top': query.top,
                'api-version': BUILD_API_VERSION
            },
            retries: 3,
            signal
        });
        return response.value ?? [];
    }

    async getProjectId(projectNameOrId: string, signal?: AbortSignal): Promise<string> {
        const project = await this.http.json<{ id: string }>(`${this.root}/_apis/projects/${encodeURIComponent(projectNameOrId)}`, {
            query: { 'api-version': BUILD_API_VERSION },
            retries: 3,
            signal
        });
        return project.id;
    }
}
