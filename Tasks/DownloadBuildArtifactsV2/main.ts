import * as fs from 'fs';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import {
    ArtifactDownloadParameters,
    ArtifactProviders,
    BuildClient,
    BuildResult,
    downloadArtifactsFromBuild,
    FileContainerProvider,
    HttpClient,
    isNullOrWhiteSpace,
    Logger,
    MatchOptions,
    parseDotNetBoolean,
    parseDotNetGuid,
    parseDotNetInt32,
    PipelineArtifactProvider,
    ProxyConfig,
    requireProjectGuid,
    resolveTriggeringPipelineId,
    trimDotNet,
    FileShareProvider
} from 'azure-pipelines-tasks-pipeline-artifacts-common';

tl.setResourcePath(path.join(__dirname, 'task.json'));

const BUILD_TYPE_CURRENT = 'current';
const BUILD_TYPE_SPECIFIC = 'specific';
const BUILD_VERSION_LATEST = 'latest';
const BUILD_VERSION_SPECIFIC = 'specific';
const BUILD_VERSION_LATEST_FROM_BRANCH = 'latestFromBranch';
const DOWNLOAD_TYPE_SINGLE = 'single';
const EXTRACTED_TARS_DIR = 'extracted_tars';

interface SelectedBuild {
    project: string;
    pipelineId: number;
}

function createLogger(): Logger {
    return {
        debug: message => tl.debug(message),
        info: message => console.log(message),
        warning: message => tl.warning(message),
        error: message => tl.error(message)
    };
}

function createHttpClient(collectionUri: string, logger: Logger): HttpClient {
    const accessToken = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'ACCESSTOKEN', false);
    if (!accessToken) {
        throw new Error('The job access token is not available.');
    }

    let proxy: ProxyConfig | undefined;
    const proxyConfiguration = tl.getHttpProxyConfiguration(collectionUri);
    if (proxyConfiguration) {
        proxy = {
            url: proxyConfiguration.proxyUrl,
            username: proxyConfiguration.proxyUsername,
            password: proxyConfiguration.proxyPassword,
            bypass: proxyConfiguration.proxyBypassHosts
        };
    }

    const ca: Buffer[] = [];
    const certificateConfiguration = tl.getHttpCertConfiguration();
    if (certificateConfiguration?.caFile && fs.existsSync(certificateConfiguration.caFile)) {
        ca.push(fs.readFileSync(certificateConfiguration.caFile));
    }

    const host = new URL(collectionUri).hostname;
    return new HttpClient({
        authorization: () => `Bearer ${accessToken}`,
        trustedHosts: [host, '.dev.azure.com', '.visualstudio.com'],
        userAgent: `AzurePipelinesAgentTask/DownloadBuildArtifacts (node ${process.version})`,
        proxy,
        ca,
        rejectUnauthorized: !/^true$/i.test(tl.getVariable('Agent.SkipCertValidation') ?? ''),
        logger
    });
}

function getVariable(name: string): string | undefined {
    return tl.getVariable(name) ?? process.env[name] ?? process.env[name.toUpperCase()] ?? process.env[name.toLowerCase()];
}

function getKnobValue(runtimeName: string, environmentName?: string, pipelineFeatureName?: string): string | undefined {
    return getVariable(runtimeName)
        ?? (environmentName ? getVariable(environmentName) : undefined)
        ?? (pipelineFeatureName ? getVariable(`DistributedTask.Agent.${pipelineFeatureName}`) : undefined);
}

function knobEnabled(runtimeName: string, environmentName?: string, pipelineFeatureName?: string): boolean {
    return /^true$/i.test(getKnobValue(runtimeName, environmentName, pipelineFeatureName) ?? '');
}

function resolvePath(inputPath: string): string {
    if (path.isAbsolute(inputPath)) {
        return path.normalize(inputPath);
    }
    return path.resolve(tl.getVariable('system.defaultworkingdirectory') ?? process.cwd(), inputPath);
}

function splitPatterns(value: string | undefined): string[] {
    return (value && value.length ? value : '**')
        .split('\n')
        .map(entry => trimDotNet(entry))
        .filter(entry => entry.length > 0);
}

function getMinimatchOptions(targetPath: string): MatchOptions {
    const caseInsensitiveFix = knobEnabled('DistributedTask.Agent.CaseInsensitiveArtifactMatchingFixEnabled', undefined, 'CaseInsensitiveArtifactMatchingFixEnabled');
    const useCaseInsensitiveMatching = caseInsensitiveFix && (process.platform === 'win32' || process.platform === 'darwin');
    void targetPath;
    return {
        dot: true,
        nobrace: true,
        nocase: useCaseInsensitiveMatching
    };
}

async function cleanDirectory(directoryPath: string, logger: Logger): Promise<void> {
    console.log(tl.loc('CleaningDestinationFolder', directoryPath));
    let stat: fs.Stats;
    try {
        stat = await fs.promises.stat(directoryPath);
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
            tl.warning(tl.loc('NoFolderToClean', directoryPath));
            return;
        }
        throw error;
    }

    if (!stat.isDirectory()) {
        await fs.promises.rm(directoryPath, { recursive: true, force: true });
        return;
    }

    const entries = await fs.promises.readdir(directoryPath);
    if (entries.length === 0) {
        tl.warning(tl.loc('NoFolderToClean', directoryPath));
        return;
    }

    for (const entry of entries) {
        const fullPath = path.join(directoryPath, entry);
        logger.debug(`Deleting ${fullPath}`);
        await fs.promises.rm(fullPath, { recursive: true, force: true, maxRetries: 2, retryDelay: 1000 });
    }
}

function getResultFilter(allowPartiallySucceededBuilds: boolean, allowFailedBuilds: boolean, allowCanceledBuilds: boolean): number {
    let result = BuildResult.Succeeded;
    if (allowPartiallySucceededBuilds) {
        result |= BuildResult.PartiallySucceeded;
    }
    if (allowFailedBuilds) {
        result |= BuildResult.Failed;
    }
    if (allowCanceledBuilds) {
        result |= BuildResult.Canceled;
    }
    return result;
}

function outputBuildInfo(pipelineId: number): void {
    console.log(tl.loc('DownloadingFromBuild', pipelineId));
    tl.setVariable('BuildNumber', String(pipelineId));
}

async function getPipelineId(
    client: BuildClient,
    pipelineDefinition: string,
    buildVersionToDownload: string,
    project: string,
    tagFilters: string[],
    resultFilter: number,
    branchName?: string
): Promise<number> {
    if (!pipelineDefinition || isNullOrWhiteSpace(pipelineDefinition)) {
        throw new Error(tl.loc('CannotBeNullOrEmpty', 'Pipeline Definition'));
    }

    let definitionId = parseDotNetInt32(pipelineDefinition);
    if (definitionId === undefined) {
        const definitions = await client.getDefinitionsByName(project, pipelineDefinition);
        const definition = definitions[0];
        if (!definition) {
            throw new Error(tl.loc('PipelineDoesNotExist', pipelineDefinition));
        }
        definitionId = definition.id;
    }

    const builds = await client.getBuilds(project, {
        definitions: [definitionId],
        branchName: buildVersionToDownload === BUILD_VERSION_LATEST_FROM_BRANCH ? branchName : undefined,
        tagFilters,
        resultFilter,
        statusFilter: 'completed',
        queryOrder: 'finishTimeDescending'
    });

    if (builds.length === 0) {
        throw new Error(tl.loc('BuildsDoesNotExist'));
    }

    return builds[0].id;
}

async function resolveProject(client: BuildClient, projectName: string): Promise<string> {
    const projectId = parseDotNetGuid(projectName);
    if (projectId) {
        return projectId;
    }

    try {
        return await client.getProjectId(projectName);
    } catch (error) {
        throw new Error(`Get project failed ${projectName} , exception: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function getTriggeringProjectId(): string | undefined {
    const hostType = tl.getVariable('system.hostType') ?? '';
    const variable = hostType && !/^build$/i.test(hostType)
        ? `release.artifacts.${tl.getVariable('release.triggeringartifact.alias') ?? ''}.projectId`
        : 'build.triggeredBy.projectId';
    return parseDotNetGuid(tl.getVariable(variable));
}

async function selectBuild(client: BuildClient, resultFilter: number): Promise<SelectedBuild> {
    const buildType = tl.getInput('buildType', true)!;
    const definition = tl.getInput('definition', false) ?? '';
    const buildVersionToDownload = tl.getInput('buildVersionToDownload', false) ?? BUILD_VERSION_LATEST;
    const specificBuildWithTriggering = parseDotNetBoolean(tl.getInput('specificBuildWithTriggering', false));
    const branchName = tl.getInput('branchName', false) ?? '';
    const projectInput = tl.getInput('project', false) ?? '';
    const tagFilters = (tl.getInput('tags', false) ?? '').split(',');
    const userSpecifiedBuildId = tl.getInput('buildId', false) ?? '';

    if (buildType === BUILD_TYPE_CURRENT) {
        const projectIdText = tl.getVariable('System.TeamProjectId');
        if (!projectIdText) {
            throw new Error(tl.loc('CannotBeNullOrEmpty', 'Project ID'));
        }
        const projectId = requireProjectGuid(projectIdText);

        const environmentBuildId = tl.getVariable('Build.BuildId') ?? '';
        const pipelineId = parseDotNetInt32(environmentBuildId) ?? 0;
        if (pipelineId === 0) {
            const hostType = tl.getVariable('system.hosttype') ?? '';
            if (/^(Release|DeploymentGroup)$/i.test(hostType)) {
                throw new Error(tl.loc('BuildIdIsNotAvailable', hostType, hostType));
            }
            if (!/^Build$/i.test(hostType)) {
                throw new Error(tl.loc('CannotDownloadFromCurrentEnvironment', hostType));
            }
            throw new Error(tl.loc('BuildIdIsNotValid', environmentBuildId));
        }

        outputBuildInfo(pipelineId);
        return { project: projectId, pipelineId };
    }

    if (buildType !== BUILD_TYPE_SPECIFIC) {
        throw new Error(`Build type '${buildType}' is not recognized.`);
    }

    if (!projectInput) {
        throw new Error(tl.loc('CannotBeNullOrEmpty', 'Project Name'));
    }

    let projectId = await resolveProject(client, projectInput);
    let pipelineId = 0;
    if (specificBuildWithTriggering) {
        pipelineId = resolveTriggeringPipelineId(name => tl.getVariable(name), definition);
        projectId = getTriggeringProjectId() ?? projectId;
    }

    if (pipelineId === 0) {
        if (buildVersionToDownload === BUILD_VERSION_LATEST) {
            pipelineId = await getPipelineId(client, definition, buildVersionToDownload, projectId, tagFilters, resultFilter);
        } else if (buildVersionToDownload === BUILD_VERSION_SPECIFIC) {
            pipelineId = parseDotNetInt32(userSpecifiedBuildId) ?? 0;
            if (pipelineId === 0) {
                throw new Error(tl.loc('RunIDNotValid', userSpecifiedBuildId));
            }
        } else if (buildVersionToDownload === BUILD_VERSION_LATEST_FROM_BRANCH) {
            pipelineId = await getPipelineId(client, definition, buildVersionToDownload, projectId, tagFilters, resultFilter, branchName);
        } else {
            throw new Error('Unreachable code!');
        }
    }

    outputBuildInfo(pipelineId);
    return { project: projectInput, pipelineId };
}

async function run(): Promise<void> {
    const logger = createLogger();
    tl.getInput('buildType', true);
    tl.getInput('downloadType', true);
    const targetPath = resolvePath(tl.getInput('downloadPath', true)!);
    const cleanDestinationFolder = parseDotNetBoolean(tl.getInput('cleanDestinationFolder', false));
    const extractTars = parseDotNetBoolean(tl.getInput('extractTars', false));
    if (extractTars && process.platform === 'win32') {
        throw new Error(tl.loc('TarExtractionNotSupportedInWindows'));
    }

    const collectionUri = tl.getVariable('System.TeamFoundationCollectionUri');
    if (!collectionUri) {
        throw new Error(tl.loc('CannotBeNullOrEmpty', 'System.TeamFoundationCollectionUri'));
    }

    const http = createHttpClient(collectionUri, logger);
    try {
        const client = new BuildClient(http, collectionUri);
        const allowPartiallySucceededBuilds = parseDotNetBoolean(tl.getInput('allowPartiallySucceededBuilds', false));
        const allowFailedBuilds = parseDotNetBoolean(tl.getInput('allowFailedBuilds', false));
        const allowCanceledBuilds = parseDotNetBoolean(tl.getInput('allowCanceledBuilds', false));
        const resultFilter = getResultFilter(allowPartiallySucceededBuilds, allowFailedBuilds, allowCanceledBuilds);
        const selected = await selectBuild(client, resultFilter);

        // Like the plugin, the destination folder is only created and cleaned once the build is known: a build that
        // cannot be found must not delete anything.
        await fs.promises.mkdir(targetPath, { recursive: true });
        if (cleanDestinationFolder) {
            await cleanDirectory(targetPath, logger);
            await fs.promises.mkdir(targetPath, { recursive: true });
        }

        const parameters: ArtifactDownloadParameters = {
            project: selected.project,
            pipelineId: selected.pipelineId,
            artifactName: tl.getInput('artifactName', false) ?? '',
            targetDirectory: targetPath,
            minimatchFilters: splitPatterns(tl.getInput('itemPattern', false) ?? '**'),
            minimatchFilterWithArtifactName: true,
            includeArtifactNameInPath: true,
            parallelizationLimit: parseDotNetInt32(tl.getInput('parallelizationLimit', false)) ?? 8,
            retryDownloadCount: parseDotNetInt32(tl.getInput('retryDownloadCount', false)) ?? 4,
            checkDownloadedFiles: parseDotNetBoolean(tl.getInput('checkDownloadedFiles', false)),
            customMinimatchOptions: getMinimatchOptions(targetPath),
            extractTars,
            extractedTarsTempPath: path.join(tl.getVariable('Agent.TempDirectory') ?? targetPath, EXTRACTED_TARS_DIR),
            appendArtifactNameToTargetPath: knobEnabled('EnableIncompatibleBuildArtifactsPathResolution', 'EnableIncompatibleBuildArtifactsPathResolution')
        };

        const dedupParallelism = Number(getKnobValue('AZURE_PIPELINES_DEDUP_PARALLELISM'));
        const providerContext = {
            http,
            collectionUri,
            logger,
            dedupParallelism: Number.isInteger(dedupParallelism) && dedupParallelism > 0 ? dedupParallelism : undefined,
            signal: undefined,
            getVariable,
            loc: tl.loc
        };
        const providers: ArtifactProviders = {
            pipelineArtifact: new PipelineArtifactProvider(providerContext),
            container: new FileContainerProvider(providerContext),
            fileShare: new FileShareProvider(providerContext)
        };

        console.log(tl.loc('DownloadArtifactTo', targetPath));
        await downloadArtifactsFromBuild({
            buildClient: client,
            params: parameters,
            providers,
            downloadAll: tl.getInput('downloadType', true) !== DOWNLOAD_TYPE_SINGLE,
            setVariable: (name, value) => tl.setVariable(name, value)
        });
        console.log(tl.loc('DownloadArtifactFinished'));
    } finally {
        http.close();
    }
}

run().catch(error => {
    tl.setResult(tl.TaskResult.Failed, error instanceof Error ? error.message : String(error));
});
