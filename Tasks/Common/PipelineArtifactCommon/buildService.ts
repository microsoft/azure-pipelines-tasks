import * as tl from "azure-pipelines-task-lib/task";
import { WebApi, getBearerHandler } from "azure-devops-node-api/WebApi";
import { IRequestOptions } from "azure-devops-node-api/interfaces/common/VsoBaseInterfaces";
import { BuildArtifact, BuildQueryOrder, BuildResult } from "azure-devops-node-api/interfaces/BuildInterfaces";

export { BuildArtifact, BuildResult };

/** The Azure Pipelines queries the tasks make. Implemented with azure-devops-node-api and by fakes in tests. */
export interface PipelineBuildService {
    /** Gets a project's ID from its name, or undefined when there is no such project. */
    getProjectId(project: string): Promise<string | undefined>;
    /** Gets the ID of the first pipeline definition with the name, or undefined when there is none. */
    getDefinitionId(projectId: string, name: string): Promise<number | undefined>;
    /** Gets the most recently finished run of a definition that matches the filters, or undefined. */
    getLatestRunId(projectId: string, definitionId: number, branch: string | undefined, tags: string[], resultFilter: BuildResult): Promise<number | undefined>;
    /** Gets one artifact of a run, or undefined when the run has no artifact with the name. */
    getArtifact(projectId: string, runId: number, name: string): Promise<BuildArtifact | undefined>;
    /** Gets all artifacts of a run. */
    getArtifacts(projectId: string, runId: number): Promise<BuildArtifact[]>;
}

/** Connects to the collection with the job access token, honoring the agent's proxy and certificate settings. */
export function createBuildService(collectionUrl: string, accessToken: string): PipelineBuildService {
    const options: IRequestOptions = { allowRetries: true, maxRetries: 3 };
    const proxy = tl.getHttpProxyConfiguration(collectionUrl);
    if (proxy) {
        options.proxy = proxy;
    }
    const cert = tl.getHttpCertConfiguration();
    if (cert) {
        options.cert = cert;
    }

    const connection = new WebApi(collectionUrl, getBearerHandler(accessToken), options);
    return {
        getProjectId: async project => (await (await connection.getCoreApi()).getProject(project))?.id,
        getDefinitionId: async (projectId, name) => (await (await connection.getBuildApi()).getDefinitions(projectId, name))?.[0]?.id,
        getLatestRunId: async (projectId, definitionId, branch, tags, resultFilter) => {
            const builds = await (await connection.getBuildApi()).getBuilds(
                projectId, [definitionId], undefined, undefined, undefined, undefined, undefined, undefined, undefined,
                resultFilter, tags.length > 0 ? tags : undefined, undefined, 1, undefined, undefined, undefined, BuildQueryOrder.FinishTimeDescending, branch);
            return builds?.[0]?.id;
        },
        getArtifact: async (projectId, runId, name) => (await (await connection.getBuildApi()).getArtifact(projectId, runId, name)) ?? undefined,
        getArtifacts: async (projectId, runId) => (await (await connection.getBuildApi()).getArtifacts(projectId, runId)) ?? []
    };
}
