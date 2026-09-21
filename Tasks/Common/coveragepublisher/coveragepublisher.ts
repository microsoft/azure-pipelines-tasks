import * as path from 'path';
import * as fs from 'fs';
import { createHash, randomBytes } from 'crypto';
import { execSync } from 'child_process';
import * as os from 'os';
import * as taskLib from 'azure-pipelines-task-lib/task';
import * as toolRunner from 'azure-pipelines-task-lib/toolrunner';
import * as azureDevOps from 'azure-devops-node-api';
import * as TestInterfaces from 'azure-devops-node-api/interfaces/TestInterfaces';
import { HttpClient, HttpClientResponse } from 'typed-rest-client/HttpClient';
import { IRequestOptions } from 'typed-rest-client/Interfaces';

const rawCoverageSchemaVersion = '1.0';
const rawCoverageSchemaMajorVersion = 1;
const rawCoverageNamespace = 'Intermediate/coverage/Raw/v1';
const testResultsResourceAreaId = 'c83eaf52-edf3-4034-ae11-17d38f25404c';
const rawCoverageCapabilityPath = '_apis/testresults/codecoverage/rawcoveragebundle/capabilities';
const rawCoverageCapabilityApiVersion = '7.2-preview.1';
const producer = 'PublishCodeCoverageResultsV2';
const uploadBlockSize = 4 * 1024 * 1024;
const uploadParallelism = 8;
const storageApiVersion = '2020-10-02';

export enum CoveragePublicationMode {
    LegacyOnly = 'legacy-only',
    Additive = 'additive',
    RawOnly = 'raw-only'
}

export interface CoverageFileInput {
    filePath: string;
    sourcePatternIndexes?: number[];
}

export interface CoveragePublicationOptions {
    workingDirectory?: string;
    taskVersion?: string;
    taskInstanceId?: string;
}

export interface RawCoverageOrigin {
    originalName: string;
    workspaceRelativePath: string | null;
    pathKind: 'workspace-relative' | 'external';
    normalizedExtension: string;
    sourcePatternIndexes: number[];
}

export interface RawCoverageManifestEntry {
    ordinal: number;
    blobPath: string;
    originalName: string;
    workspaceRelativePath: string | null;
    normalizedExtension: string;
    declaredFormat: null;
    detectedFormat: string | null;
    mimeType: string;
    byteLength: number;
    sha256: string;
    sourcePatternIndexes: number[];
    origins: RawCoverageOrigin[];
    isGenerated: false;
    uploadStatus: 'uploaded';
}

export interface RawCoverageManifest {
    schemaVersion: '1.0';
    rawCoverageSetId: string;
    producer: typeof producer;
    taskVersion: string;
    buildId: number;
    projectId: string;
    taskInstanceId: string;
    sourceRoot: {
        kind: 'workspace-relative' | 'external' | 'unspecified';
        path?: string;
    };
    createdUtc: string;
    entries: RawCoverageManifestEntry[];
}

interface UploadContext {
    collectionUri: string;
    projectId: string;
    buildId: number;
    accessToken: string;
}

export interface RawUploadContext extends UploadContext {
    taskInstanceId: string;
    taskVersion: string;
    testResultsServiceUri?: string;
    workingDirectory?: string;
}

export interface PreparedBlob {
    inputFile: string;
    entry: RawCoverageManifestEntry;
}

export interface RawCoverageCapability {
    contractVersion?: string;
    acceptedSchemaMajorVersions?: number[];
    supportedModes?: string[];
}

export async function PublishCodeCoverage(
    inputFiles: Array<string | CoverageFileInput>,
    sourceDirectory?: string,
    options: CoveragePublicationOptions = {}): Promise<void> {

    if (!inputFiles || inputFiles.length === 0) {
        throw new Error(taskLib.loc('NoInputFiles'));
    }

    const normalizedInputs = normalizeCoverageInputs(inputFiles);
    const context = getUploadContext();
    configureProxyEnvironment();
    const capabilityServiceUri = await resolveTestResultsServiceUri(context.collectionUri, context.accessToken);
    const capabilityHttpClient = createHttpClient(capabilityServiceUri);
    let mode = CoveragePublicationMode.LegacyOnly;

    try {
        mode = await getCoveragePublicationMode(
            capabilityHttpClient,
            capabilityServiceUri,
            context.projectId,
            context.accessToken);
    } finally {
        capabilityHttpClient.dispose();
    }

    if (mode === CoveragePublicationMode.LegacyOnly) {
        await publishCoverageWithReportGenerator(normalizedInputs.map(input => input.filePath), sourceDirectory, context);
        return;
    }

    if (mode === CoveragePublicationMode.Additive) {
        try {
            const rawUploadContext = getRawUploadContext(context, options, capabilityServiceUri);
            await publishRawCoverageBundle(normalizedInputs, sourceDirectory, rawUploadContext);
        } catch (error) {
            taskLib.warning(taskLib.loc('RawCoverageUploadFailedAdditive', getErrorMessage(error)));
        }

        await publishCoverageWithReportGenerator(normalizedInputs.map(input => input.filePath), sourceDirectory, context);
        return;
    }

    const rawUploadContext = getRawUploadContext(context, options, capabilityServiceUri);
    await publishRawCoverageBundle(normalizedInputs, sourceDirectory, rawUploadContext);
}

export async function resolveTestResultsServiceUri(
    collectionUri: string,
    accessToken: string): Promise<string> {

    try {
        const authHandler = azureDevOps.getHandlerFromToken(accessToken);
        const webApi = new azureDevOps.WebApi(collectionUri, authHandler);
        const locationsApi = await webApi.getLocationsApi();
        const resourceArea = await locationsApi.getResourceArea(testResultsResourceAreaId);
        if (resourceArea && resourceArea.locationUrl) {
            return ensureTrailingSlash(new URL(resourceArea.locationUrl).toString());
        }
    } catch (error) {
        taskLib.debug(`Unable to resolve the Test Results service location: ${getErrorMessage(error)}`);
    }

    return ensureTrailingSlash(collectionUri);
}

export async function getCoveragePublicationMode(
    httpClient: HttpClient,
    collectionUri: string,
    projectId: string,
    accessToken: string): Promise<CoveragePublicationMode> {

    const capabilityUrl = getRawCoverageCapabilityUrl(collectionUri, projectId);

    try {
        const response = await httpClient.get(
            capabilityUrl.toString(),
            {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`
            });
        const statusCode = response.message.statusCode || 0;
        if (statusCode === 404) {
            taskLib.debug(`Raw coverage capability endpoint '${capabilityUrl}' is not available.`);
            return CoveragePublicationMode.LegacyOnly;
        }

        if (statusCode < 200 || statusCode >= 300) {
            taskLib.warning(taskLib.loc('UnableToGetRawCoverageCapability', statusCode));
            return CoveragePublicationMode.LegacyOnly;
        }

        const capability = JSON.parse(await response.readBody()) as RawCoverageCapability;
        return parseCoveragePublicationMode(capability);
    } catch (error) {
        taskLib.warning(taskLib.loc('UnableToGetRawCoverageCapability', getErrorMessage(error)));
        return CoveragePublicationMode.LegacyOnly;
    }
}

export function getRawCoverageCapabilityUrl(collectionUri: string, projectId: string): URL {
    const projectPath = `${encodeURIComponent(projectId)}/${rawCoverageCapabilityPath}`;
    const url = new URL(projectPath, ensureTrailingSlash(collectionUri));
    url.searchParams.set('api-version', rawCoverageCapabilityApiVersion);
    return url;
}

export function parseCoveragePublicationMode(capability: RawCoverageCapability): CoveragePublicationMode {
    if (!capability
        || capability.contractVersion !== rawCoverageSchemaVersion
        || !Array.isArray(capability.acceptedSchemaMajorVersions)
        || !capability.acceptedSchemaMajorVersions.includes(rawCoverageSchemaMajorVersion)
        || !Array.isArray(capability.supportedModes)) {
        return CoveragePublicationMode.LegacyOnly;
    }

    if (capability.supportedModes.includes('raw-authoritative')) {
        return CoveragePublicationMode.RawOnly;
    }

    if (capability.supportedModes.includes('shadow')) {
        return CoveragePublicationMode.Additive;
    }

    return CoveragePublicationMode.LegacyOnly;
}

export async function prepareRawCoverageBundle(
    inputs: CoverageFileInput[],
    sourceDirectory: string | undefined,
    context: RawUploadContext,
    createdUtc: string = new Date().toISOString()): Promise<{ manifest: RawCoverageManifest, blobs: PreparedBlob[] }> {

    const rawCoverageSetId = createDeterministicRawCoverageSetId(
        context.projectId,
        context.buildId,
        context.taskInstanceId);
    const originsByHash = new Map<string, Array<{ inputFile: string, origin: RawCoverageOrigin, byteLength: number }>>();

    for (const input of inputs) {
        const filePath = path.resolve(input.filePath);
        const fileInfo = await hashFile(filePath);
        const origin = createOrigin(filePath, input.sourcePatternIndexes, context.workingDirectory);
        const existing = originsByHash.get(fileInfo.sha256) || [];
        existing.push({
            inputFile: filePath,
            origin,
            byteLength: fileInfo.byteLength
        });
        originsByHash.set(fileInfo.sha256, existing);
    }

    const blobs: PreparedBlob[] = Array.from(originsByHash.entries()).map(([sha256, matchingInputs]) => {
        matchingInputs.sort((left, right) => compareOrigins(left.origin, right.origin));
        const primary = matchingInputs[0];
        const sanitizedName = sanitizeBlobName(primary.origin.originalName);
        const normalizedExtension = path.extname(primary.origin.originalName).toLowerCase();
        const origins = mergeOrigins(matchingInputs.map(item => item.origin));
        const sourcePatternIndexes = Array.from(new Set(origins.flatMap(origin => origin.sourcePatternIndexes))).sort(compareNumbers);

        return {
            inputFile: primary.inputFile,
            entry: {
                ordinal: 0,
                blobPath: `blobs/${sha256}/${sanitizedName}`,
                originalName: primary.origin.originalName,
                workspaceRelativePath: primary.origin.workspaceRelativePath,
                normalizedExtension,
                declaredFormat: null,
                detectedFormat: detectFormat(normalizedExtension, primary.origin.originalName),
                mimeType: getMimeType(normalizedExtension),
                byteLength: primary.byteLength,
                sha256,
                sourcePatternIndexes,
                origins,
                isGenerated: false,
                uploadStatus: 'uploaded'
            }
        };
    });

    blobs.sort((left, right) => compareStrings(left.entry.blobPath, right.entry.blobPath));
    blobs.forEach((blob, ordinal) => blob.entry.ordinal = ordinal);

    return {
        manifest: {
            schemaVersion: rawCoverageSchemaVersion,
            rawCoverageSetId,
            producer,
            taskVersion: context.taskVersion,
            buildId: context.buildId,
            projectId: context.projectId,
            taskInstanceId: context.taskInstanceId,
            sourceRoot: classifySourceRoot(sourceDirectory, context.workingDirectory),
            createdUtc,
            entries: blobs.map(blob => blob.entry)
        },
        blobs
    };
}

export async function publishRawCoverageBundle(
    inputs: CoverageFileInput[],
    sourceDirectory: string | undefined,
    context: RawUploadContext): Promise<RawCoverageManifest> {

    const authHandler = azureDevOps.getHandlerFromToken(context.accessToken);
    const webApi = new azureDevOps.WebApi(context.collectionUri, authHandler);
    const testResultsApi = await webApi.getTestResultsApi();
    const endpoint = await testResultsApi.testLogStoreEndpointDetailsForBuild(
        context.projectId,
        context.buildId,
        TestInterfaces.TestLogStoreOperationType.Create);

    if (!endpoint || !endpoint.endpointSASUri) {
        throw new Error(taskLib.loc('UnableToGetCoverageContainer', endpoint && endpoint.status));
    }

    const prepared = await prepareRawCoverageBundle(inputs, sourceDirectory, context);
    const setRoot = `${rawCoverageNamespace}/${prepared.manifest.rawCoverageSetId}`;
    const httpClient = createHttpClient(endpoint.endpointSASUri);

    try {
        for (const blob of prepared.blobs) {
            const blobName = `${setRoot}/${blob.entry.blobPath}`;
            taskLib.debug(taskLib.loc('UploadingCoverageFile', blob.inputFile, blobName));
            await uploadFile(httpClient, endpoint.endpointSASUri, blobName, blob.inputFile);
            taskLib.debug(taskLib.loc('PublishedCoverageFile', blob.inputFile, blobName));
        }

        const manifestBlobName = `${setRoot}/manifest.json`;
        await uploadJson(httpClient, endpoint.endpointSASUri, manifestBlobName, prepared.manifest);
        taskLib.debug(taskLib.loc('PublishedRawCoverageManifest', manifestBlobName));
        await queueRawCoverageProcessing(context);
        return prepared.manifest;
    } finally {
        httpClient.dispose();
    }
}

async function publishCoverageWithReportGenerator(
    inputFiles: string[],
    sourceDirectory: string | undefined,
    context: UploadContext): Promise<void> {

    const reportDirectory = path.join(getTempFolder(), randomBytes(16).toString('hex'));
    fs.mkdirSync(reportDirectory);

    const osPlatform = process.platform;
    let dotnet: toolRunner.ToolRunner;

    const dotnetPath = taskLib.which('dotnet', false);
    if (!dotnetPath && osPlatform !== 'win32') {
        taskLib.warning(taskLib.loc('InstallDotNetCoreForPublishing'));
        return;
    }

    if (osPlatform === 'win32') {
        dotnet = taskLib.tool(path.join(__dirname, 'CoveragePublisher', 'CoveragePublisher.Console.exe'));
    } else if (osPlatform === 'linux') {
        const executablePath = path.join(__dirname, 'CoveragePublisher', 'linux-x64', 'CoveragePublisher.Console');
        execSync(`chmod +x "${executablePath}"`);
        dotnet = taskLib.tool(executablePath);
    } else if (osPlatform === 'darwin') {
        const executablePath = path.join(__dirname, 'CoveragePublisher', 'osx-x64', 'CoveragePublisher.Console');
        execSync(`chmod +x "${executablePath}"`);
        dotnet = taskLib.tool(executablePath);
    } else {
        dotnet = taskLib.tool(dotnetPath);
        dotnet.arg(path.join(__dirname, 'CoveragePublisher', 'CoveragePublisher.Console.dll'));
    }

    dotnet.arg(inputFiles);
    dotnet.arg('--reportDirectory');
    dotnet.arg(reportDirectory);

    if (sourceDirectory && sourceDirectory.trim()) {
        dotnet.arg('--sourceDirectory');
        dotnet.arg(sourceDirectory);
    }

    await dotnet.exec({
        env: {
            ...process.env,
            ...getProxyEnvironmentVariables(),
            SYSTEM_ACCESSTOKEN: context.accessToken,
            SYSTEM_TEAMFOUNDATIONCOLLECTIONURI: context.collectionUri,
            BUILD_BUILDID: context.buildId.toString(),
            BUILD_CONTAINERID: taskLib.getVariable('Build.ContainerId'),
            AGENT_TEMPPATH: taskLib.getVariable('Agent.TempPath'),
            SYSTEM_TEAMPROJECTID: context.projectId,
            SYSTEM_TASKINSTANCEID: taskLib.getVariable('System.TaskInstanceId'),
            PIPELINES_COVERAGEPUBLISHER_DEBUG: taskLib.getVariable('PIPELINES_COVERAGEPUBLISHER_DEBUG'),
            DOTNET_SYSTEM_GLOBALIZATION_INVARIANT: taskLib.getVariable('DOTNET_SYSTEM_GLOBALIZATION_INVARIANT')
        },
        ignoreReturnCode: false,
        failOnStdErr: true,
        windowsVerbatimArguments: true
    } as any);
}

function getUploadContext(): UploadContext {
    const collectionUri = taskLib.getVariable('System.TeamFoundationCollectionUri');
    const projectId = taskLib.getVariable('System.TeamProjectId');
    const buildIdValue = taskLib.getVariable('Build.BuildId');
    const accessToken = taskLib.getEndpointAuthorizationParameter('SystemVssConnection', 'AccessToken', false);
    const buildId = Number(buildIdValue);

    if (!collectionUri || !projectId || !buildIdValue || !Number.isInteger(buildId) || buildId <= 0 || !accessToken) {
        throw new Error(taskLib.loc('MissingPipelineContext'));
    }

    return {
        collectionUri,
        projectId,
        buildId,
        accessToken
    };
}

async function queueRawCoverageProcessing(context: RawUploadContext): Promise<void> {
    const triggerUrl = getRawCoverageCapabilityUrl(context.testResultsServiceUri, context.projectId);
    triggerUrl.searchParams.set('buildId', context.buildId.toString());

    const httpClient = createHttpClient(context.testResultsServiceUri);
    try {
        const response = await httpClient.post(
            triggerUrl.toString(),
            '',
            {
                Accept: 'application/json',
                Authorization: ['Bearer', context.accessToken].join(' '),
                'Content-Type': 'application/json'
            });
        const statusCode = response.message.statusCode || 0;
        if (statusCode < 200 || statusCode >= 300) {
            throw new Error(taskLib.loc('UnableToQueueRawCoverageProcessing', statusCode));
        }
    } finally {
        httpClient.dispose();
    }
}

function getRawUploadContext(
    context: UploadContext,
    options: CoveragePublicationOptions,
    testResultsServiceUri: string): RawUploadContext {
    const taskInstanceId = options.taskInstanceId || taskLib.getVariable('System.TaskInstanceId');
    const taskVersion = options.taskVersion;
    if (!taskInstanceId || !taskVersion) {
        throw new Error(taskLib.loc('MissingRawCoverageContext'));
    }

    return {
        ...context,
        taskInstanceId,
        taskVersion,
        testResultsServiceUri,
        workingDirectory: options.workingDirectory
    };
}

function normalizeCoverageInputs(inputs: Array<string | CoverageFileInput>): CoverageFileInput[] {
    return inputs.map(input => typeof input === 'string'
        ? { filePath: input, sourcePatternIndexes: [] }
        : {
            filePath: input.filePath,
            sourcePatternIndexes: normalizePatternIndexes(input.sourcePatternIndexes)
        });
}

function createOrigin(
    inputFile: string,
    sourcePatternIndexes: number[] | undefined,
    workingDirectory: string | undefined): RawCoverageOrigin {

    const relativePath = getWorkspaceRelativePath(inputFile, workingDirectory);
    return {
        originalName: path.basename(inputFile),
        workspaceRelativePath: relativePath,
        pathKind: relativePath === null ? 'external' : 'workspace-relative',
        normalizedExtension: path.extname(inputFile).toLowerCase(),
        sourcePatternIndexes: normalizePatternIndexes(sourcePatternIndexes)
    };
}

function mergeOrigins(origins: RawCoverageOrigin[]): RawCoverageOrigin[] {
    const merged = new Map<string, RawCoverageOrigin>();
    for (const origin of origins) {
        const key = `${origin.pathKind}\n${origin.workspaceRelativePath || ''}\n${origin.originalName}`;
        const existing = merged.get(key);
        if (existing) {
            existing.sourcePatternIndexes = Array.from(new Set([
                ...existing.sourcePatternIndexes,
                ...origin.sourcePatternIndexes
            ])).sort(compareNumbers);
        } else {
            merged.set(key, {
                ...origin,
                sourcePatternIndexes: [...origin.sourcePatternIndexes]
            });
        }
    }

    return Array.from(merged.values()).sort(compareOrigins);
}

function compareOrigins(left: RawCoverageOrigin, right: RawCoverageOrigin): number {
    return compareStrings(
        `${left.workspaceRelativePath || ''}\n${left.originalName}`,
        `${right.workspaceRelativePath || ''}\n${right.originalName}`);
}

function compareStrings(left: string, right: string): number {
    if (left < right) {
        return -1;
    }

    return left > right ? 1 : 0;
}

function compareNumbers(left: number, right: number): number {
    return left - right;
}

function normalizePatternIndexes(indexes: number[] | undefined): number[] {
    return Array.from(new Set((indexes || []).filter(index => Number.isInteger(index) && index >= 0))).sort(compareNumbers);
}

function getWorkspaceRelativePath(inputFile: string, workingDirectory: string | undefined): string | null {
    if (!workingDirectory) {
        return null;
    }

    const relativePath = path.relative(path.resolve(workingDirectory), path.resolve(inputFile));
    if (relativePath === '..'
        || relativePath.startsWith(`..${path.sep}`)
        || path.isAbsolute(relativePath)) {
        return null;
    }

    return normalizePath(relativePath || path.basename(inputFile));
}

function classifySourceRoot(
    sourceDirectory: string | undefined,
    workingDirectory: string | undefined): RawCoverageManifest['sourceRoot'] {

    if (!sourceDirectory || !sourceDirectory.trim()) {
        return { kind: 'unspecified' };
    }

    if (!workingDirectory) {
        return { kind: 'external' };
    }

    const relativePath = path.relative(path.resolve(workingDirectory), path.resolve(sourceDirectory));
    if (relativePath === '..'
        || relativePath.startsWith(`..${path.sep}`)
        || path.isAbsolute(relativePath)) {
        return { kind: 'external' };
    }

    return {
        kind: 'workspace-relative',
        path: normalizePath(relativePath || '.')
    };
}

function normalizePath(value: string): string {
    return value.split(path.sep).join('/');
}

export function createDeterministicRawCoverageSetId(
    projectId: string,
    buildId: number,
    taskInstanceId: string): string {

    const bytes = createHash('sha256')
        .update(`${rawCoverageSchemaVersion}\n${projectId.toLowerCase()}\n${buildId}\n${taskInstanceId.toLowerCase()}`)
        .digest()
        .subarray(0, 16);
    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
}

async function hashFile(inputFile: string): Promise<{ sha256: string, byteLength: number }> {
    return new Promise((resolve, reject) => {
        const hash = createHash('sha256');
        let byteLength = 0;
        const input = fs.createReadStream(inputFile);
        input.on('data', chunk => {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            byteLength += buffer.length;
            hash.update(buffer);
        });
        input.on('error', reject);
        input.on('end', () => resolve({
            sha256: hash.digest('hex'),
            byteLength
        }));
    });
}

export function sanitizeBlobName(originalName: string): string {
    const sanitized = originalName
        .normalize('NFKC')
        .replace(/[^A-Za-z0-9._-]+/g, '_')
        .replace(/^[._-]+/, '')
        .substring(0, 160);
    return sanitized || 'coverage';
}

function detectFormat(extension: string, originalName: string): string | null {
    switch (extension) {
        case '.coverage':
            return 'visual-studio-coverage';
        case '.covx':
            return 'visual-studio-covx';
        case '.covb':
            return 'visual-studio-covb';
        case '.info':
        case '.lcov':
            return 'lcov';
        case '.gcov':
            return 'gcov';
        case '.json':
            return 'coverage.py-json';
        default:
            return originalName.toLowerCase().endsWith('coverprofile') ? 'go-coverprofile' : null;
    }
}

function getMimeType(extension: string): string {
    switch (extension) {
        case '.xml':
        case '.covx':
            return 'application/xml';
        case '.json':
            return 'application/json';
        default:
            return 'application/octet-stream';
    }
}

export function createHttpClient(requestUrl: string): HttpClient {
    return new HttpClient(
        'azure-pipelines-publish-code-coverage-results-v2',
        [],
        createHttpClientOptions(requestUrl));
}

export function createHttpClientOptions(requestUrl: string): IRequestOptions {
    return {
        allowRetries: true,
        maxRetries: 3,
        proxy: taskLib.getHttpProxyConfiguration(requestUrl)
    };
}

function ensureTrailingSlash(value: string): string {
    return value.endsWith('/') ? value : `${value}/`;
}

function configureProxyEnvironment(): void {
    const proxyVariables = getProxyEnvironmentVariables();
    Object.keys(proxyVariables).forEach(name => process.env[name] = proxyVariables[name]);
}

function getProxyEnvironmentVariables(): { [key: string]: string } {
    const proxyVariables: { [key: string]: string } = {};
    const proxy = taskLib.getHttpProxyConfiguration();
    if (!proxy) {
        return proxyVariables;
    }

    proxyVariables.HTTP_PROXY = proxy.proxyFormattedUrl;
    proxyVariables.HTTPS_PROXY = proxy.proxyFormattedUrl;
    proxyVariables.http_proxy = proxy.proxyFormattedUrl;
    proxyVariables.https_proxy = proxy.proxyFormattedUrl;
    return proxyVariables;
}

function getTempFolder(): string {
    try {
        taskLib.assertAgent('2.115.0');
        return taskLib.getVariable('Agent.TempDirectory');
    } catch (error) {
        taskLib.warning(taskLib.loc('UpgradeAgentMessage'));
        return os.tmpdir();
    }
}

export function getBlobUrl(endpointSASUri: string, blobName: string): URL {
    const endpoint = new URL(endpointSASUri);

    if ((endpoint.protocol !== 'https:' && endpoint.protocol !== 'http:') || !endpoint.pathname || !endpoint.search) {
        throw new Error(taskLib.loc('InvalidCoverageContainerUrl'));
    }

    const encodedBlobName = blobName.split('/').map(segment => encodeURIComponent(segment)).join('/');
    endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/${encodedBlobName}`;
    return endpoint;
}

export async function uploadFile(httpClient: HttpClient, endpointSASUri: string, blobName: string, inputFile: string): Promise<void> {
    const blobUrl = getBlobUrl(endpointSASUri, blobName);
    const fileSize = fs.statSync(inputFile).size;

    if (fileSize === 0) {
        await putBlob(httpClient, blobUrl, '', 'application/octet-stream', inputFile);
        return;
    }

    const blockIds = createBlockIds(fileSize);
    let nextBlock = 0;
    let uploadError: unknown;
    const uploadWorkers = Array.from(
        { length: Math.min(uploadParallelism, blockIds.length) },
        async () => {
            while (!uploadError && nextBlock < blockIds.length) {
                const blockIndex = nextBlock++;
                try {
                    await uploadBlock(httpClient, blobUrl, inputFile, fileSize, blockIndex, blockIds[blockIndex]);
                } catch (error) {
                    uploadError = error;
                }
            }
        });

    await Promise.all(uploadWorkers);
    if (uploadError) {
        throw uploadError;
    }

    await commitBlockList(httpClient, blobUrl, blockIds, inputFile);
}

export function createBlockIds(fileSize: number): string[] {
    const blockCount = Math.ceil(fileSize / uploadBlockSize);
    return Array.from({ length: blockCount }, (_, index) =>
        Buffer.from(index.toString().padStart(8, '0')).toString('base64'));
}

async function uploadJson(
    httpClient: HttpClient,
    endpointSASUri: string,
    blobName: string,
    value: unknown): Promise<void> {

    const body = JSON.stringify(value);
    await putBlob(httpClient, getBlobUrl(endpointSASUri, blobName), body, 'application/json', blobName);
}

async function uploadBlock(
    httpClient: HttpClient,
    blobUrl: URL,
    inputFile: string,
    fileSize: number,
    blockIndex: number,
    blockId: string): Promise<void> {

    const start = blockIndex * uploadBlockSize;
    const end = Math.min(start + uploadBlockSize, fileSize) - 1;
    const blockUrl = new URL(blobUrl.toString());
    blockUrl.searchParams.set('comp', 'block');
    blockUrl.searchParams.set('blockid', blockId);

    const response = await httpClient.sendStream(
        'PUT',
        blockUrl.toString(),
        fs.createReadStream(inputFile, { start, end }),
        getStorageHeaders(end - start + 1));

    await ensureSuccessfulResponse(response, inputFile);
}

async function commitBlockList(httpClient: HttpClient, blobUrl: URL, blockIds: string[], inputFile: string): Promise<void> {
    const blockListUrl = new URL(blobUrl.toString());
    blockListUrl.searchParams.set('comp', 'blocklist');
    const blockList = `<?xml version="1.0" encoding="utf-8"?><BlockList>${blockIds.map(id => `<Latest>${id}</Latest>`).join('')}</BlockList>`;
    const headers = getStorageHeaders(Buffer.byteLength(blockList));
    headers['Content-Type'] = 'application/xml';
    headers['x-ms-blob-content-type'] = 'application/octet-stream';

    const response = await httpClient.put(blockListUrl.toString(), blockList, headers);
    await ensureSuccessfulResponse(response, inputFile);
}

async function putBlob(
    httpClient: HttpClient,
    blobUrl: URL,
    body: string,
    contentType: string,
    sourceDescription: string): Promise<void> {

    const headers = getStorageHeaders(Buffer.byteLength(body));
    headers['Content-Type'] = contentType;
    headers['x-ms-blob-content-type'] = contentType;
    headers['x-ms-blob-type'] = 'BlockBlob';
    const response = await httpClient.put(blobUrl.toString(), body, headers);
    await ensureSuccessfulResponse(response, sourceDescription);
}

function getStorageHeaders(contentLength: number): { [key: string]: string | number } {
    return {
        'Content-Length': contentLength,
        'x-ms-version': storageApiVersion
    };
}

async function ensureSuccessfulResponse(response: HttpClientResponse, inputFile: string): Promise<void> {
    const statusCode = response.message.statusCode || 0;
    if (statusCode >= 200 && statusCode < 300) {
        return;
    }

    const responseBody = await response.readBody();
    throw new Error(taskLib.loc('CoverageFileUploadFailed', inputFile, `${statusCode} ${responseBody}`.trim()));
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
