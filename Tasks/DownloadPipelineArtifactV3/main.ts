import * as fs from 'fs';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import {
    ArtifactDownloadParameters,
    BuildClient,
    downloadArtifactsFromBuild,
    FileContainerProvider,
    FileShareProvider,
    getResultFilter,
    HttpClient,
    Logger,
    PipelineArtifactProvider,
    ProxyConfig,
    parseDotNetBoolean,
    parseDotNetInt32,
    requireProjectGuid,
    resolveSpecificRun
} from 'azure-pipelines-tasks-pipeline-artifacts-common';

tl.setResourcePath(path.join(__dirname, 'task.json'));

const SOURCE_RUN_CURRENT = 'current';
const SOURCE_RUN_SPECIFIC = 'specific';
const FORBIDDEN_ARTIFACT_NAME_CHARS = /[\u0000-\u001f":<>|*?/\\]/;

interface TaskLibLike {
    getInput(name: string, required?: boolean): string | undefined;
    getVariable(name: string): string | undefined;
    setVariable(name: string, value: string, secret?: boolean): void;
    debug(message: string): void;
    warning(message: string): void;
    error(message: string): void;
    loc(key: string, ...args: unknown[]): string;
    setResult(result: tl.TaskResult, message: string): void;
    getEndpointAuthorizationParameter(id: string, key: string, optional: boolean): string | undefined;
    getHttpProxyConfiguration(targetUrl?: string): {
        proxyUrl: string;
        proxyUsername?: string;
        proxyPassword?: string;
        proxyBypassHosts?: string[];
    } | null | undefined;
    getHttpCertConfiguration(): { caFile?: string } | null | undefined;
}

export function isValidArtifactName(name: string): boolean {
    return !FORBIDDEN_ARTIFACT_NAME_CHARS.test(name);
}

function createLogger(taskLib: TaskLibLike): Logger {
    return {
        debug: message => taskLib.debug(message),
        info: message => console.log(message),
        warning: message => taskLib.warning(message),
        error: message => taskLib.error(message)
    };
}

function createHttpClient(collectionUri: string, logger: Logger, taskLib: TaskLibLike): HttpClient {
    const accessToken = taskLib.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'ACCESSTOKEN', false);
    if (!accessToken) {
        throw new Error('The job access token is not available.');
    }

    let proxy: ProxyConfig | undefined;
    const proxyConfiguration = taskLib.getHttpProxyConfiguration(collectionUri);
    if (proxyConfiguration) {
        proxy = {
            url: proxyConfiguration.proxyUrl,
            username: proxyConfiguration.proxyUsername,
            password: proxyConfiguration.proxyPassword,
            bypass: proxyConfiguration.proxyBypassHosts
        };
    }

    const ca: Buffer[] = [];
    const certificateConfiguration = taskLib.getHttpCertConfiguration();
    if (certificateConfiguration?.caFile && fs.existsSync(certificateConfiguration.caFile)) {
        ca.push(fs.readFileSync(certificateConfiguration.caFile));
    }

    const host = new URL(collectionUri).hostname;
    return new HttpClient({
        authorization: () => `Bearer ${accessToken}`,
        trustedHosts: [host, '.dev.azure.com', '.visualstudio.com'],
        userAgent: `AzurePipelinesAgentTask/DownloadPipelineArtifact (node ${process.version})`,
        proxy,
        ca,
        rejectUnauthorized: !/^true$/i.test(taskLib.getVariable('Agent.SkipCertValidation') ?? ''),
        logger
    });
}

function resolvePath(value: string, defaultWorkingDirectory: string | undefined): string {
    if (path.isAbsolute(value)) {
        return path.normalize(value);
    }
    return path.resolve(defaultWorkingDirectory ?? process.cwd(), value);
}

function createDirectoryIfDoesntExist(targetPath: string): string {
    const fullPath = path.resolve(targetPath);
    fs.mkdirSync(fullPath, { recursive: true });
    return fullPath;
}

function outputBuildInfo(taskLib: TaskLibLike, pipelineId: number): void {
    console.log(taskLib.loc('DownloadingFromBuild', pipelineId));
    taskLib.setVariable('BuildNumber', pipelineId.toString());
}

function createDownloadParameters(project: string, pipelineId: number, artifactName: string, targetDirectory: string, minimatchFilters: string[]): ArtifactDownloadParameters {
    return {
        project,
        pipelineId,
        artifactName,
        targetDirectory,
        minimatchFilters,
        minimatchFilterWithArtifactName: true,
        includeArtifactNameInPath: false,
        parallelizationLimit: 8,
        retryDownloadCount: 4,
        checkDownloadedFiles: false,
        extractTars: false,
        appendArtifactNameToTargetPath: true
    };
}

export async function executeDownloadPipelineArtifact(taskLib: TaskLibLike = tl, httpClient?: HttpClient): Promise<void> {
    const artifactName = taskLib.getInput('artifact', false) ?? '';
    const branchName = taskLib.getInput('runBranch', false) ?? '';
    const pipelineDefinition = taskLib.getInput('pipeline', false) ?? '';
    const sourceRun = taskLib.getInput('source', true) ?? '';
    const pipelineTriggering = taskLib.getInput('preferTriggeringPipeline', false) ?? '';
    const pipelineVersionToDownload = taskLib.getInput('runVersion', false) ?? '';
    const rawTargetPath = taskLib.getInput('path', true) ?? '';
    const environmentBuildId = taskLib.getVariable('Build.BuildId') ?? '';
    const itemPatternInput = taskLib.getInput('patterns', false) ?? '';
    const projectName = taskLib.getInput('project', false) ?? '';
    const tags = taskLib.getInput('tags', false) ?? '';
    const allowPartiallySucceededBuilds = taskLib.getInput('allowPartiallySucceededBuilds', false);
    const allowFailedBuilds = taskLib.getInput('allowFailedBuilds', false);
    const allowCanceledBuilds = taskLib.getInput('allowCanceledBuilds', false);
    const userSpecifiedRunId = taskLib.getInput('runId', false) ?? '';
    const defaultWorkingDirectory = taskLib.getVariable('system.defaultworkingdirectory');

    const targetPath = resolvePath(rawTargetPath, defaultWorkingDirectory);
    taskLib.debug(`TargetPath: ${targetPath}`);

    const onPrem = (taskLib.getVariable('System.ServerType') ?? '').toLowerCase() !== 'hosted';
    if (onPrem) {
        throw new Error(taskLib.loc('OnPremIsNotSupported'));
    }

    if (artifactName !== '' && !isValidArtifactName(artifactName)) {
        throw new Error(taskLib.loc('ArtifactNameIsNotValid', artifactName));
    }
    taskLib.debug(`ArtifactName: ${artifactName}`);

    const itemPattern = itemPatternInput === '' ? '**' : itemPatternInput;
    const minimatchPatterns = itemPattern.split('\n').filter(pattern => pattern !== '');
    const tagsInput = tags.split(',');
    const resultFilter = getResultFilter(parseDotNetBoolean(allowPartiallySucceededBuilds), parseDotNetBoolean(allowFailedBuilds), parseDotNetBoolean(allowCanceledBuilds));
    taskLib.debug(`BuildResult: ${resultFilter.toString()}`);

    const collectionUri = taskLib.getVariable('System.TeamFoundationCollectionUri') ?? '';
    const logger = createLogger(taskLib);
    let ownedHttpClient: HttpClient | undefined = httpClient;
    let buildClient: BuildClient | undefined;

    const getBuildClient = (): BuildClient => {
        if (!collectionUri) {
            throw new Error(taskLib.loc('CannotBeNullOrEmpty', 'System.TeamFoundationCollectionUri'));
        }
        if (!buildClient) {
            ownedHttpClient = ownedHttpClient ?? createHttpClient(collectionUri, logger, taskLib);
            buildClient = new BuildClient(ownedHttpClient, collectionUri);
        }
        return buildClient;
    };

    try {
        let downloadParameters: ArtifactDownloadParameters;

        if (sourceRun === SOURCE_RUN_CURRENT) {
            taskLib.debug('Run: CurrentRun');
            const projectIdText = taskLib.getVariable('system.teamProjectId') ?? '';
            if (!projectIdText) {
                throw new Error(taskLib.loc('CannotBeNullOrEmpty', 'Project ID'));
            }
            const projectId = requireProjectGuid(projectIdText);
            taskLib.debug(`ProjectId: ${projectId}`);

            const pipelineId = parseDotNetInt32(environmentBuildId) ?? 0;

            if (pipelineId !== 0) {
                outputBuildInfo(taskLib, pipelineId);
            } else {
                const hostType = taskLib.getVariable('system.hosttype') ?? '';
                if (hostType.localeCompare('Release', undefined, { sensitivity: 'accent' }) === 0 || hostType.localeCompare('DeploymentGroup', undefined, { sensitivity: 'accent' }) === 0) {
                    throw new Error(taskLib.loc('BuildIdIsNotAvailable', hostType, hostType));
                }
                if (hostType.localeCompare('Build', undefined, { sensitivity: 'accent' }) !== 0) {
                    throw new Error(taskLib.loc('CannotDownloadFromCurrentEnvironment', hostType));
                }
                throw new Error(taskLib.loc('BuildIdIsNotValid', environmentBuildId));
            }

            downloadParameters = createDownloadParameters(projectId, pipelineId, artifactName, targetPath, minimatchPatterns);
        } else if (sourceRun === SOURCE_RUN_SPECIFIC) {
            taskLib.debug('Run: Specific');
            const { projectId, pipelineId } = await resolveSpecificRun({
                buildClient: getBuildClient(),
                loc: taskLib.loc,
                debug: message => taskLib.debug(message)
            }, {
                projectInput: projectName,
                pipelineDefinition,
                preferTriggeringPipeline: pipelineTriggering,
                runVersion: pipelineVersionToDownload,
                runIdInput: userSpecifiedRunId,
                branchName,
                tagFilters: tagsInput,
                resultFilter,
                getVariable: name => taskLib.getVariable(name)
            });
            taskLib.debug(`ProjectId: ${projectId}`);
            outputBuildInfo(taskLib, pipelineId);
            downloadParameters = createDownloadParameters(projectName, pipelineId, artifactName, targetPath, minimatchPatterns);
        } else {
            throw new Error(`Build type '${sourceRun}' is not recognized.`);
        }

        if (!collectionUri) {
            throw new Error(taskLib.loc('CannotBeNullOrEmpty', 'System.TeamFoundationCollectionUri'));
        }

        createDirectoryIfDoesntExist(targetPath);
        console.log(taskLib.loc('DownloadArtifactTo', targetPath));
        const client = getBuildClient();
        const dedupParallelism = Number(taskLib.getVariable('AZURE_PIPELINES_DEDUP_PARALLELISM'));
        const providerContext = {
            http: ownedHttpClient!,
            collectionUri,
            logger,
            dedupParallelism: Number.isInteger(dedupParallelism) && dedupParallelism > 0 ? dedupParallelism : undefined,
            getVariable: (name: string) => taskLib.getVariable(name)
        };
        await downloadArtifactsFromBuild({
            buildClient: client,
            params: downloadParameters,
            providers: {
                pipelineArtifact: new PipelineArtifactProvider(providerContext),
                container: new FileContainerProvider(providerContext),
                fileShare: new FileShareProvider(providerContext)
            },
            setVariable: (name, value) => taskLib.setVariable(name, value)
        });
        console.log(taskLib.loc('DownloadArtifactFinished'));
    } finally {
        if (!httpClient) {
            ownedHttpClient?.close();
        }
    }
}

async function run(): Promise<void> {
    try {
        await executeDownloadPipelineArtifact();
        tl.setResult(tl.TaskResult.Succeeded, '');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        tl.setResult(tl.TaskResult.Failed, message);
    }
}

run();
