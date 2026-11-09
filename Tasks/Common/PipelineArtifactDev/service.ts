import { WebApi, getHandlerFromToken } from "azure-devops-node-api/WebApi";
import { BuildArtifact, BuildQueryOrder, BuildResult } from "azure-devops-node-api/interfaces/BuildInterfaces";
import { FileContainerItem } from "azure-devops-node-api/interfaces/FileContainerInterfaces";
import * as tl from "azure-pipelines-task-lib/task";

export interface BuildQuery {
    definition: number;
    tags: string[];
    results: BuildResult;
    branch?: string;
}

export interface ArtifactService {
    projectId(project: string): Promise<string>;
    definitionId(project: string, definition: string): Promise<number>;
    latestRun(project: string, query: BuildQuery): Promise<number>;
    artifacts(project: string, runId: number, name?: string): Promise<BuildArtifact[]>;
    associate(project: string, runId: number, artifact: BuildArtifact): Promise<void>;
    containerItems(containerId: number, project: string, root: string): Promise<FileContainerItem[]>;
    containerFile(containerId: number, project: string, item: string): Promise<NodeJS.ReadableStream>;
}

export function validateServiceUrl(value: string): void {
    const url = new URL(value);
    const trusted = ["dev.azure.com", "visualstudio.com", "codedev.ms", "vsts.me"]
        .some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
    if (url.protocol !== "https:" || !trusted || url.username || url.password) {
        throw new Error("The system service URL must be HTTPS on a trusted Azure DevOps host.");
    }
}

export function createArtifactService(serviceUrl: string, token: string): ArtifactService {
    validateServiceUrl(serviceUrl);
    const web = new WebApi(serviceUrl, getHandlerFromToken(token), {
        allowRetries: true,
        maxRetries: 3,
        proxy: tl.getHttpProxyConfiguration(serviceUrl) ?? undefined,
        cert: tl.getHttpCertConfiguration() ?? undefined
    });
    return {
        async projectId(project) {
            if (/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(project)) {
                return project;
            }
            const result = await (await web.getCoreApi()).getProject(project);
            if (!result.id) {
                throw new Error("Project lookup returned no ID.");
            }
            return result.id;
        },
        async definitionId(project, definition) {
            if (/^\d+$/.test(definition)) {
                const id = Number(definition);
                if (id < 1 || id > 2147483647) {
                    throw new Error("Invalid pipeline definition ID.");
                }
                return id;
            }
            const definitions = await (await web.getBuildApi()).getDefinitions(project, definition);
            const id = definitions[0]?.id;
            if (!id) {
                throw new Error("The requested pipeline definition does not exist.");
            }
            return id;
        },
        async latestRun(project, query) {
            const builds = await (await web.getBuildApi()).getBuilds(
                project, [query.definition], undefined, undefined, undefined, undefined, undefined, undefined,
                undefined, query.results, query.tags, undefined, 1, undefined, undefined, undefined,
                BuildQueryOrder.FinishTimeDescending, query.branch);
            const id = builds[0]?.id;
            if (!id) {
                throw new Error("No build matches the requested pipeline, branch, tags, and results.");
            }
            return id;
        },
        async artifacts(project, runId, name) {
            const build = await web.getBuildApi();
            return name ? [await build.getArtifact(project, runId, name)] : build.getArtifacts(project, runId);
        },
        async associate(project, runId, artifact) {
            await (await web.getBuildApi()).createArtifact(artifact, project, runId);
        },
        async containerItems(containerId, project, root) {
            return (await web.getFileContainerApi()).getItems(
                containerId, project, root, undefined, undefined, undefined, undefined, false);
        },
        async containerFile(containerId, project, item) {
            const response = await (await web.getFileContainerApi()).getItem(containerId, project, item);
            if (response.statusCode !== 200 || !response.result) {
                throw new Error(`Container file download failed with HTTP ${response.statusCode}.`);
            }
            return response.result;
        }
    };
}
