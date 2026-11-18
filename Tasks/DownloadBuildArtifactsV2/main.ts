import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import {
    ArtifactDownloadParameters,
    ArtifactError,
    ArtifactProviders,
    BuildClient,
    BuildResult,
    closeSharedWorkerPool,
    downloadArtifactsFromBuild,
    FileContainerProvider,
    HttpClient,
    HttpError,
    isFilesystemCaseInsensitive,
    isNullOrWhiteSpace,
    isValidArtifactName,
    Logger,
    MatchOptions,
    parseDotNetBoolean,
    parseDotNetGuid,
    parseDotNetInt32,
    PipelineArtifactProvider,
    ProxyConfig,
    readClientCertificate,
    RequestTimeoutError,
    requireProjectGuid,
    resolveTriggeringPipelineId,
    telemetry,
    trimDotNet,
    FileShareProvider
} from './DownloadEngine';

tl.setResourcePath(path.join(__dirname, 'task.json'));

const BUILD_TYPE_CURRENT = 'current';
const BUILD_TYPE_SPECIFIC = 'specific';
const BUILD_VERSION_LATEST = 'latest';
const BUILD_VERSION_SPECIFIC = 'specific';
const BUILD_VERSION_LATEST_FROM_BRANCH = 'latestFromBranch';
const DOWNLOAD_TYPE_SINGLE = 'single';
const DOWNLOAD_TYPE_SPECIFIC = 'specific';
const EXTRACTED_TARS_DIR = 'extracted_tars';
const TELEMETRY_AREA = 'DownloadBuildArtifacts';
const TELEMETRY_FEATURE = 'download';
const BUILT_IN_ERRORS = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'URIError', 'AggregateError']);
const SYSTEM_ERROR_CODES = new Set([
    'ECONNRESET', 'ECONNREFUSED', 'ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'EHOSTUNREACH', 'ENETUNREACH', 'EPROTO',
    'ENOSPC', 'EACCES', 'EPERM', 'ENOENT', 'EEXIST', 'EMFILE', 'ENFILE', 'EISDIR', 'ENOTDIR', 'ENOTEMPTY', 'ENAMETOOLONG', 'EBUSY', 'EROFS',
    'EINVAL', 'ENOMEM', 'EXDEV', 'EIO', 'ELOOP',
    'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'DEPTH_ZERO_SELF_SIGNED_CERT',
    'SELF_SIGNED_CERT_IN_CHAIN', 'ERR_TLS_CERT_ALTNAME_INVALID'
]);
const GUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VERSION_FORMAT = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;

interface SelectedBuild {
    project: string;
    pipelineId: number;
}

/** How many artifacts of the build were skipped because of their name; such a run ends as failed, like in the agent plugin. */
let invalidArtifactNames = 0;

/** The agent runs a line of the output that starts with ##vso[ as a command, and file names of an artifact can hold such a line. */
function writeLine(message: string, source: 'remote' | 'repository' = 'remote'): void {
    tl.writeExternalOutput(message + os.EOL, { source });
}

function createLogger(): Logger {
    // The agent parses every debug line the task library writes, even when system.debug is off. A download of 100,000 files writes some
    // 200,000 of them, and leaving them out saves about a quarter of its time.
    const debugEnabled = /^true$/i.test(tl.getVariable('system.debug') ?? '');
    return {
        debug: debugEnabled ? message => tl.debug(message) : () => undefined,
        info: message => writeLine(message),
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
    const clientCertificate = readClientCertificate(certificateConfiguration, logger);

    const host = new URL(collectionUri).hostname;
    return new HttpClient({
        authorization: () => `Bearer ${accessToken}`,
        trustedHosts: [host, '.dev.azure.com', '.visualstudio.com'],
        userAgent: `AzurePipelinesAgentTask/DownloadBuildArtifacts (node ${process.version})`,
        proxy,
        ca,
        clientCertificate,
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

/** undefined selects the default of the machine, 0 turns the threads off. */
function getWorkerThreadsSetting(): number | undefined {
    const value = getKnobValue('AZURE_PIPELINES_DEDUP_WORKER_THREADS');
    return value !== undefined && /^\s*\d+\s*$/.test(value) ? Number(value) : undefined;
}

/** undefined selects the default of the machine (the threads download with more than two processors), true and false turn the downloads on the threads on and off. */
function getWorkerDownloadsSetting(): boolean | undefined {
    const value = getKnobValue('AZURE_PIPELINES_DEDUP_WORKER_DOWNLOADS')?.trim();
    if (value === undefined) {
        return undefined;
    }
    return /^(1|true)$/i.test(value) ? true : /^(0|false)$/i.test(value) ? false : undefined;
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

/**
 * Like the agent plugin, names are matched without regard to case when the pipeline feature CaseInsensitiveArtifactMatchingFixEnabled is on:
 * always on Windows, and on macOS when the destination is on a file system that ignores case (some Mac disks are case-sensitive).
 */
function getMinimatchOptions(targetPath: string): MatchOptions {
    const caseInsensitiveFix = knobEnabled('DistributedTask.Agent.CaseInsensitiveArtifactMatchingFixEnabled', undefined, 'CaseInsensitiveArtifactMatchingFixEnabled');
    const useCaseInsensitiveMatching = caseInsensitiveFix
        && (process.platform === 'win32' || (process.platform === 'darwin' && isFilesystemCaseInsensitive(targetPath)));
    return {
        dot: true,
        nobrace: true,
        nocase: useCaseInsensitiveMatching
    };
}

async function cleanDirectory(directoryPath: string, logger: Logger): Promise<void> {
    writeLine(tl.loc('CleaningDestinationFolder', directoryPath), 'repository');
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
    writeLine(tl.loc('DownloadingFromBuild', pipelineId));
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
    // The name of an artifact becomes a folder name. A single download is refused here, before a service is asked and before the destination
    // is touched; when all artifacts are downloaded, the names come from the build and are checked as they are listed.
    if (tl.getInput('downloadType', true) === DOWNLOAD_TYPE_SINGLE) {
        const artifactName = tl.getInput('artifactName', false) ?? '';
        if (!isValidArtifactName(artifactName)) {
            throw new Error(tl.loc('ArtifactNameIsNotValidWithStrictValidation', artifactName));
        }
    }
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

        // Like the plugin, the destination folder is only created and cleaned once the build is known: a build that cannot be found
        // must not delete anything.
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
            validateTarSymlinks: extractTars && tl.getPipelineFeature('EnableTarSymlinkValidation'),
            extractedTarsTempPath: path.join(tl.getVariable('Agent.TempDirectory') ?? targetPath, EXTRACTED_TARS_DIR),
            appendArtifactNameToTargetPath: knobEnabled('EnableIncompatibleBuildArtifactsPathResolution', 'EnableIncompatibleBuildArtifactsPathResolution')
        };

        const dedupParallelism = Number(getKnobValue('AZURE_PIPELINES_DEDUP_PARALLELISM'));
        const providerContext = {
            http,
            collectionUri,
            logger,
            dedupParallelism: Number.isInteger(dedupParallelism) && dedupParallelism > 0 ? dedupParallelism : undefined,
            workerThreads: getWorkerThreadsSetting(),
            workerDownloads: getWorkerDownloadsSetting(),
            signal: undefined,
            getVariable,
            loc: tl.loc
        };
        const providers: ArtifactProviders = {
            pipelineArtifact: new PipelineArtifactProvider(providerContext),
            container: new FileContainerProvider(providerContext),
            fileShare: new FileShareProvider(providerContext)
        };

        writeLine(tl.loc('DownloadArtifactTo', targetPath), 'repository');
        await downloadArtifactsFromBuild({
            buildClient: client,
            params: parameters,
            providers,
            downloadAll: tl.getInput('downloadType', true) !== DOWNLOAD_TYPE_SINGLE,
            onInvalidArtifactName: name => {
                // The artifact is skipped and the others are downloaded, but the task fails in the end.
                invalidArtifactNames++;
                tl.setResult(tl.TaskResult.Failed, tl.loc('ArtifactNameIsNotValidWithStrictValidation', name ?? ''));
            },
            setVariable: (name, value) => tl.setVariable(name, value)
        });
        writeLine(tl.loc('DownloadArtifactFinished'));
    } finally {
        http.close();
        await closeSharedWorkerPool();
    }
}

const startedAt = Date.now();

run().then(
    () => publishTelemetry(startedAt),
    error => {
        publishTelemetry(startedAt, { error });
        tl.setResult(tl.TaskResult.Failed, error instanceof Error ? error.message : String(error));
    });

/**
 * Publishes one event per run: how it went and how it was set up, as counts, sizes and fixed-form values, never names, paths, URLs or
 * messages. A pipeline opts out with the variable task.publishTelemetry set to false, which the agent honors. It must never change the
 * result of the task.
 */
function publishTelemetry(startedAt: number, failure?: { error: unknown }): void {
    try {
        const properties = {
            result: failure || invalidArtifactNames > 0 ? 'failed' : 'succeeded',
            durationMs: Date.now() - startedAt,
            ...(failure ? describeError(failure.error) : {}),
            ...(invalidArtifactNames > 0 ? { invalidArtifactNames } : {}),
            ...environmentProperties(),
            ...inputProperties(),
            ...telemetry.snapshot()
        };
        tl.command('telemetry.publish', { area: TELEMETRY_AREA, feature: TELEMETRY_FEATURE }, JSON.stringify(properties));
    } catch (error) {
        try {
            tl.debug(`The telemetry was not published: ${error instanceof Error ? error.message : 'unknown error'}`);
        } catch {
            // Telemetry never changes the result of the task.
        }
    }
}

/**
 * Only the kind of the error, never what it says: the message may hold names, paths and URLs, and the name and code of an error are
 * published only when the runtime or the download code defines them.
 */
function describeError(error: unknown): Record<string, string | number> {
    const kind = error instanceof Error ? error.constructor.name : undefined;
    const known = error instanceof ArtifactError || error instanceof RequestTimeoutError || (kind !== undefined && BUILT_IN_ERRORS.has(kind));
    const described: Record<string, string | number> = { errorType: known && kind !== undefined ? kind : 'Unknown' };
    if (error instanceof HttpError && Number.isInteger(error.status) && error.status >= 100 && error.status <= 599) {
        described.errorStatus = error.status;
    }
    const code = (error as { code?: unknown } | null | undefined)?.code;
    if (typeof code === 'string' && SYSTEM_ERROR_CODES.has(code)) {
        described.errorCode = code;
    }
    return described;
}

function formatted(value: string | undefined, format: RegExp): string | undefined {
    return value !== undefined && format.test(value) ? value : undefined;
}

function taskVersion(): string | undefined {
    try {
        const { version } = JSON.parse(fs.readFileSync(path.join(__dirname, 'task.json'), 'utf8'));
        return formatted(`${version.Major}.${version.Minor}.${version.Patch}`, VERSION_FORMAT);
    } catch {
        return undefined;
    }
}

function environmentProperties(): Record<string, string | undefined> {
    return {
        taskVersion: taskVersion(),
        hostType: oneOf(tl.getVariable('System.HostType'), ['build', 'release', 'deployment']),
        agentVersion: formatted(tl.getVariable('Agent.Version'), VERSION_FORMAT),
        agentOS: oneOf(tl.getVariable('Agent.OS'), ['Linux', 'Darwin', 'Windows_NT']),
        agentArchitecture: oneOf(tl.getVariable('Agent.OSArchitecture'), ['X86', 'X64', 'ARM', 'ARM64']),
        nodeVersion: process.version,
        jobId: formatted(tl.getVariable('System.JobId'), GUID_FORMAT),
        planId: formatted(tl.getVariable('System.PlanId'), GUID_FORMAT)
    };
}

/** Values outside the known choices are reported as 'other', so that nothing a user typed leaves the job. */
function oneOf(value: string | undefined, choices: readonly string[]): string | undefined {
    if (value === undefined) {
        return undefined;
    }
    return choices.includes(value) ? value : 'other';
}

function inputProperties(): Record<string, string | number | boolean | undefined> {
    const pattern = tl.getInput('itemPattern', false)?.trim();
    return {
        buildType: oneOf(tl.getInput('buildType', false), [BUILD_TYPE_CURRENT, BUILD_TYPE_SPECIFIC]),
        downloadType: oneOf(tl.getInput('downloadType', false), [DOWNLOAD_TYPE_SINGLE, DOWNLOAD_TYPE_SPECIFIC]),
        buildVersionToDownload: oneOf(tl.getInput('buildVersionToDownload', false), [BUILD_VERSION_LATEST, BUILD_VERSION_SPECIFIC, BUILD_VERSION_LATEST_FROM_BRANCH]),
        specificBuildWithTriggering: parseDotNetBoolean(tl.getInput('specificBuildWithTriggering', false)),
        cleanDestinationFolder: parseDotNetBoolean(tl.getInput('cleanDestinationFolder', false)),
        extractTars: parseDotNetBoolean(tl.getInput('extractTars', false)),
        checkDownloadedFiles: parseDotNetBoolean(tl.getInput('checkDownloadedFiles', false)),
        parallelizationLimit: parseDotNetInt32(tl.getInput('parallelizationLimit', false)),
        retryDownloadCount: parseDotNetInt32(tl.getInput('retryDownloadCount', false)),
        hasItemPattern: pattern !== undefined && pattern !== '' && pattern !== '**',
        workerThreadsSetting: getWorkerThreadsSetting(),
        workerDownloadsSetting: getWorkerDownloadsSetting()
    };
}
