import * as fs from 'fs';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { copyToFileShare } from './fileShareCopy';
import { isValidArtifactName, normalizeJobIdentifier, parseCustomProperties, parseParallelCount } from './helpers';
import {
    BuildClient,
    HttpClient,
    Logger,
    ProxyConfig,
    isNullOrWhiteSpace,
    parseDotNetInt32,
    publishPipelineArtifact,
    requireProjectGuid
} from 'azure-pipelines-tasks-pipeline-artifacts-common';

tl.setResourcePath(path.join(__dirname, 'task.json'));

const PIPELINE_TYPE = 'pipeline';
const FILE_SHARE_TYPE = 'filepath';

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
        // The job token is only sent to the organization and its sibling services (blob store, artifact services).
        trustedHosts: [host, '.dev.azure.com', '.visualstudio.com'],
        userAgent: `AzurePipelinesAgentTask/PublishPipelineArtifact (node ${process.version})`,
        proxy,
        ca,
        rejectUnauthorized: !/^true$/i.test(tl.getVariable('Agent.SkipCertValidation') ?? ''),
        logger
    });
}

function getKnob(...names: string[]): string | undefined {
    for (const name of names) {
        const value = tl.getVariable(name) ?? process.env[name];
        if (value) {
            return value;
        }
    }
    return undefined;
}

function resolvePath(value: string, defaultWorkingDirectory: string | undefined): string {
    if (path.isAbsolute(value)) {
        return path.normalize(value);
    }
    return path.resolve(defaultWorkingDirectory ?? process.cwd(), value);
}

async function run(): Promise<void> {
    const logger = createLogger();

    let artifactName = tl.getInput('artifactName', false);
    if (!artifactName) {
        console.log('Artifact name was not inserted for publishing.');
    } else {
        console.log(`Artifact name input: ${artifactName}`);
    }

    const rawTargetPath = tl.getInput('path', true)!;
    const artifactTypeInput = tl.getInput('artifactType', false);
    const artifactType = artifactTypeInput ? artifactTypeInput.toLowerCase() : PIPELINE_TYPE;
    const defaultWorkingDirectory = tl.getVariable('system.defaultworkingdirectory');
    const properties = parseCustomProperties(tl.getInput('properties', false), tl.loc);

    const onPrem = (tl.getVariable('System.ServerType') ?? '').toLowerCase() !== 'hosted';
    if (onPrem) {
        throw new Error(tl.loc('OnPremIsNotSupported'));
    }

    const targetPath = resolvePath(rawTargetPath, defaultWorkingDirectory);

    const projectIdText = tl.getVariable('System.TeamProjectId');
    if (!projectIdText) {
        throw new Error(tl.loc('CannotBeNullOrEmpty', 'Project ID'));
    }
    const projectId = requireProjectGuid(projectIdText);

    const buildIdText = tl.getVariable('Build.BuildId') ?? '';
    const buildId = parseDotNetInt32(buildIdText);
    if (buildId === undefined) {
        throw new Error(tl.loc('BuildIdIsNotValid', buildIdText));
    }

    const collectionUri = tl.getVariable('System.TeamFoundationCollectionUri');
    if (!collectionUri) {
        throw new Error(tl.loc('CannotBeNullOrEmpty', 'System.TeamFoundationCollectionUri'));
    }
    const jobId = tl.getVariable('System.JobId') ?? '';

    if (artifactType === PIPELINE_TYPE) {
        const hostType = tl.getVariable('System.HostType');
        if ((hostType ?? '').toLowerCase() !== 'build') {
            throw new Error(tl.loc('CannotUploadFromCurrentEnvironment', hostType ?? ''));
        }

        if (!artifactName || isNullOrWhiteSpace(artifactName)) {
            artifactName = normalizeJobIdentifier(tl.getVariable('System.JobIdentifier') ?? '');
        }

        if (!isValidArtifactName(artifactName)) {
            throw new Error(tl.loc('ArtifactNameIsNotValid', artifactName));
        }

        if (!fs.existsSync(targetPath)) {
            throw new Error(tl.loc('PathDoesNotExist', targetPath));
        }

        console.log(tl.loc('UploadingPipelineArtifact', targetPath, buildId));
        const http = createHttpClient(collectionUri, logger);
        try {
            const parallelism = Number(getKnob('AZURE_PIPELINES_DEDUP_PARALLELISM'));
            const associateTimeout = Number(process.env.PIPELINE_ARTIFACT_ASSOCIATE_TIMEOUT);
            await publishPipelineArtifact({
                http,
                collectionUri,
                projectId,
                buildId,
                artifactName,
                jobId,
                sourcePath: targetPath,
                properties,
                domainOverride: getKnob('SEND_PIPELINE_ARTIFACTS_TO_BLOBSTORE_DOMAIN', 'SEND_PIPELINE_ARTIFACT_ARTIFACTS_TO_BLOBSTORE_DOMAIN'),
                dedupParallelism: Number.isInteger(parallelism) && parallelism > 0 ? parallelism : undefined,
                skipExternalSymlinks: /^true$/i.test(getKnob('AZP_ARTIFACT_SKIP_EXTERNAL_SYMLINKS') ?? ''),
                associateTimeoutSeconds: Number.isFinite(associateTimeout) && associateTimeout > 0 ? associateTimeout : undefined,
                logger
            });
        } finally {
            http.close();
        }
        console.log(tl.loc('UploadArtifactFinished'));
    } else if (artifactType === FILE_SHARE_TYPE) {
        if (!artifactName || isNullOrWhiteSpace(artifactName)) {
            artifactName = normalizeJobIdentifier(tl.getVariable('System.JobIdentifier') ?? '');
        }
        // The name becomes a folder below the share, so it must be a single, plain path segment.
        if (!isValidArtifactName(artifactName) || artifactName === '.' || artifactName === '..') {
            throw new Error(tl.loc('ArtifactNameIsNotValid', artifactName));
        }
        if (process.platform !== 'win32') {
            throw new Error(tl.loc('FileShareOperatingSystemNotSupported'));
        }
        const fileSharePath = resolvePath(tl.getInput('fileSharePath', true)!, defaultWorkingDirectory);
        const parallel = tl.getInput('parallel', false) === 'true';
        const parallelCount = parallel ? parseParallelCount(tl.getInput('parallelCount', false), tl.loc, message => console.log(message)) : 1;
        await publishToFileShare({ collectionUri, projectId, buildId, jobId, artifactName: artifactName ?? '', targetPath, fileSharePath, parallelCount, logger });
    } else {
        throw new Error(`Unsupported artifact type '${artifactType}'.`);
    }
}

interface FileShareOptions {
    collectionUri: string;
    projectId: string;
    buildId: number;
    jobId: string;
    artifactName: string;
    targetPath: string;
    fileSharePath: string;
    parallelCount: number;
    logger: Logger;
}

async function publishToFileShare(options: FileShareOptions): Promise<void> {
    const artifactPath = path.join(options.fileSharePath, options.artifactName);
    fs.mkdirSync(artifactPath, { recursive: true });

    const http = createHttpClient(options.collectionUri, options.logger);
    try {
        const properties: Record<string, string> = {
            artifactname: options.artifactName,
            artifacttype: FILE_SHARE_TYPE,
            artifactlocation: options.fileSharePath
        };
        const artifact = await new BuildClient(http, options.collectionUri).createArtifact(options.projectId, options.buildId, {
            name: options.artifactName,
            source: options.jobId,
            resource: { type: 'FilePath', data: options.fileSharePath, properties }
        }, 900 * 1000);
        console.log(tl.loc('AssociateArtifactWithBuild', artifact.id, options.buildId));
    } finally {
        http.close();
    }

    if (fs.existsSync(options.fileSharePath)) {
        await copyToFileShare(options.targetPath, artifactPath, options.parallelCount);
        console.log(tl.loc('CopyFileComplete', artifactPath));
    }
}

run().catch(error => {
    tl.setResult(tl.TaskResult.Failed, error instanceof Error ? error.message : String(error));
});
