import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as zlib from 'zlib';
import { execFile } from 'child_process';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { BuildArtifact } from '../build/buildClient';
import { ArtifactError, IntegrityError, errorMessage } from '../errors';
import { DEFAULT_MAX_BUFFERED_CHUNKS, UrlLookahead, downloadBlobToFile, startFileLookahead, startWorkersFor } from '../dedup/download';
import { readChunksInOrder } from '../dedup/orderedRead';
import { DEFAULT_DOMAIN_ID, DedupTransport, discoverBlobStore, getClientSettings } from '../dedup/blobStore';
import { BlobReader } from '../dedup/blobReader';
import { BlobWorkerPool, getSharedWorkerPool } from '../dedup/blobWorkerPool';
import { BlobRef, isChunkId, isNodeId, normalizeDedupId } from '../dedup/hashing';
import { DEFAULT_DEADLINE_MS, contentDecoder } from '../http/httpClient';
import { Semaphore, forEachLimit, withRetry } from '../util/concurrency';
import { moveFile } from '../util/files';
import { DEFAULT_MATCH_OPTIONS, matchPaths } from '../util/patterns';
import { artifactPathSegments, assertLinksInside, resolveInside } from '../util/paths';
import { telemetry } from '../util/telemetry';
import { ArtifactDownloadParameters, ArtifactProvider, ProviderContext } from './types';

const CONTAINER_API_VERSION = '4.1-preview.4';
const TAR_DIRECTORY = 'extracted_tars';
const GZIP = 'GZip';
const GZIP_PREFETCH_CHUNKS = 32;
const MIN_DOWNLOAD_BYTES_PER_SECOND = 64 * 1024;
const DEFAULT_ALLOWLISTS: Record<string, string> = {
    win32: 'https://aka.ms/windows-agent-allowlist',
    linux: 'https://aka.ms/linux-agent-allowlist',
    darwin: 'https://aka.ms/macOS-agent-allowlist'
};

const execFileAsync = util.promisify(execFile);

interface FileContainerBlobMetadata {
    artifactHash: string;
    compressionType?: string;
}

interface FileContainerItem {
    path: string;
    itemType: string;
    fileLength?: number | string;
    contentLocation?: string;
    itemLocation?: string;
    blobMetadata?: FileContainerBlobMetadata;
}

interface ContainerIdAndRoot {
    containerId: number;
    artifactName: string;
}

interface BlobClientState {
    disabled: boolean;
    readers: Map<string, BlobReader>;
    location?: Awaited<ReturnType<typeof discoverBlobStore>>;
    settings?: Awaited<ReturnType<typeof getClientSettings>>;
}

function asBoolean(value: string | undefined): boolean {
    return /^true$/i.test(value ?? '');
}

function itemIsFile(item: FileContainerItem): boolean {
    return String(item.itemType).toLowerCase() === 'file';
}

function itemIsFolder(item: FileContainerItem): boolean {
    return String(item.itemType).toLowerCase() === 'folder';
}

function fileLengthOf(item: FileContainerItem): number {
    const value = typeof item.fileLength === 'string' ? Number(item.fileLength) : item.fileLength;
    return Number.isFinite(value) && value !== undefined ? value : 0;
}

function artifactHashParts(value: string): { domainId: string; dedupId: string } {
    const parts = value.split(',');
    if (parts.length === 1) {
        return { domainId: DEFAULT_DOMAIN_ID, dedupId: normalizeDedupId(parts[0], 'artifact hash') };
    }
    if (parts.length === 2) {
        return { domainId: parts[0].trim() || DEFAULT_DOMAIN_ID, dedupId: normalizeDedupId(parts[1], 'artifact hash') };
    }
    throw new ArtifactError(`Invalid artifact hash: ${value}`);
}

async function streamToFile(source: NodeJS.ReadableStream, contentEncoding: string | string[] | undefined, destination: string): Promise<void> {
    await fs.promises.mkdir(path.dirname(destination), { recursive: true });
    const decoder = contentDecoder(contentEncoding);
    const target = fs.createWriteStream(destination);
    await (decoder ? pipeline(source, decoder, target) : pipeline(source, target));
}

function downloadDeadlineMs(fileLength: number): number {
    return DEFAULT_DEADLINE_MS + Math.ceil(fileLength / MIN_DOWNLOAD_BYTES_PER_SECOND) * 1000;
}

export class FileContainerProvider implements ArtifactProvider {
    private readonly blob = { disabled: false, readers: new Map<string, BlobReader>() } as BlobClientState;
    // Shared by the chunks of all files that are downloaded from the blob store at the same time.
    private readonly chunkBudget = new Semaphore(DEFAULT_MAX_BUFFERED_CHUNKS);

    constructor(protected readonly context: ProviderContext) { }

    async downloadSingleArtifact(params: ArtifactDownloadParameters, artifact: BuildArtifact): Promise<void> {
        const items = await this.getArtifactItems(params, artifact);
        await this.downloadArtifactItems(items, params, artifact, params.targetDirectory, true);

        if (params.extractTars) {
            const tarCandidates = items.filter(itemIsFile).map(item => this.resolveTargetPath(params.targetDirectory, item, this.parseContainerData(artifact.resource.data).artifactName, params.includeArtifactNameInPath));
            await this.extractTarsIfPresent(tarCandidates, params.targetDirectory, params.extractedTarsTempPath ?? path.join(params.targetDirectory, TAR_DIRECTORY), params.validateTarSymlinks === true);
        }
    }

    async downloadMultipleArtifacts(params: ArtifactDownloadParameters, artifacts: BuildArtifact[]): Promise<void> {
        const allFileArtifactPaths: string[] = [];

        for (const artifact of artifacts) {
            const artifactRoot = params.appendArtifactNameToTargetPath
                ? resolveInside(params.targetDirectory, artifactPathSegments('/' + artifact.name.replace(/\\/g, '/')))
                : params.targetDirectory;
            const items = await this.getArtifactItems(params, artifact);
            const { artifactName } = this.parseContainerData(artifact.resource.data);
            for (const item of items) {
                if (itemIsFile(item)) {
                    allFileArtifactPaths.push(this.resolveTargetPath(artifactRoot, item, artifactName, params.includeArtifactNameInPath));
                }
            }
            await this.downloadArtifactItems(items, params, artifact, artifactRoot, false);
        }

        if (params.extractTars) {
            await this.extractTarsIfPresent(allFileArtifactPaths, params.targetDirectory, params.extractedTarsTempPath ?? path.join(params.targetDirectory, TAR_DIRECTORY), params.validateTarSymlinks === true);
        }
    }

    private loc(key: string, fallback: string, ...args: unknown[]): string {
        if (this.context.loc) {
            return this.context.loc(key, ...args);
        }
        return util.format(fallback, ...args);
    }

    private async getArtifactItems(params: ArtifactDownloadParameters, artifact: BuildArtifact): Promise<FileContainerItem[]> {
        const { containerId, artifactName } = this.parseContainerData(artifact.resource.data);
        const response = await this.context.http.json<{ value?: FileContainerItem[] } | FileContainerItem[]>(
            `${this.context.collectionUri.replace(/\/+$/, '')}/_apis/resources/Containers/${containerId}`,
            {
                query: {
                    itemPath: artifactName === '/' ? '' : artifactName,
                    isShallow: 'false',
                    includeBlobMetadata: 'true',
                    'api-version': CONTAINER_API_VERSION
                },
                retries: Math.max(1, params.retryDownloadCount),
                signal: this.context.signal
            }
        );

        const items = Array.isArray(response) ? response : response.value ?? [];
        const paths = items.map(item => item.path);
        const matched = new Set(matchPaths(paths, params.minimatchFilters, params.customMinimatchOptions ?? DEFAULT_MATCH_OPTIONS, this.context.logger));
        const selected = items.filter(item => matched.has(item.path));

        this.context.logger.debug(`${selected.length} final results`);
        for (const item of items) {
            if (!matched.has(item.path)) {
                this.context.logger.debug(`Item excluded: ${item.path}`);
            }
        }
        return selected;
    }

    private parseContainerData(resourceData: string): ContainerIdAndRoot {
        const parts = resourceData.split('/');
        if (parts.length < 3 || parts[0] !== '#') {
            throw new ArtifactError(`Resource data value '${resourceData}' is invalid.`);
        }
        const containerId = Number(parts[1]);
        if (!Number.isInteger(containerId) || containerId <= 0) {
            throw new ArtifactError(`Resource data value '${resourceData}' is invalid.`);
        }
        return { containerId, artifactName: parts.slice(2).join('/') };
    }

    private resolveTargetPath(rootPath: string, item: FileContainerItem, artifactName: string, includeArtifactName: boolean): string {
        const root = path.resolve(rootPath);
        if (includeArtifactName) {
            return resolveInside(root, artifactPathSegments('/' + item.path));
        }

        let prefix: string;
        if (item.path.length === artifactName.length) {
            prefix = artifactName;
        } else if (item.path.length > artifactName.length) {
            prefix = artifactName + '/';
        } else {
            throw new ArtifactError(`Item path ${item.path} cannot be smaller than artifact ${artifactName}`);
        }

        const relative = item.path.replace(prefix, '');
        return relative
            ? resolveInside(root, artifactPathSegments('/' + relative))
            : root;
    }

    private async downloadArtifactItems(items: FileContainerItem[], params: ArtifactDownloadParameters, artifact: BuildArtifact, rootPath: string, isSingleArtifactDownload: boolean): Promise<void> {
        const container = this.parseContainerData(artifact.resource.data);
        this.context.logger.info(`Start downloading FCS artifact- ${artifact.name}`);

        if (!isSingleArtifactDownload && items.length > 0) {
            await fs.promises.mkdir(rootPath, { recursive: true });
        }

        for (const folder of items.filter(itemIsFolder)) {
            await fs.promises.mkdir(this.resolveTargetPath(rootPath, folder, container.artifactName, params.includeArtifactNameInPath), { recursive: true });
        }

        const blobItems = items.filter(item => itemIsFile(item) && item.blobMetadata);
        const pool = getSharedWorkerPool(this.context.workerThreads, this.context.workerDownloads);
        const workers = await startWorkersFor(pool, blobItems.reduce((sum, item) => sum + fileLengthOf(item), 0), blobItems.length, this.context.logger, { network: pool?.downloads ? this.context.http.workerOptions() : undefined, smallChunks: true });
        const files = items.filter(itemIsFile);
        const lookahead = await this.startUrlLookahead(files);

        try {
            await forEachLimit(files, Math.max(1, params.parallelizationLimit), async (item, index) => {
                // Once the files come from the container service the URLs of the blobs are no longer needed.
                if (this.blob.disabled) {
                    lookahead?.stop();
                } else {
                    lookahead?.advance(index + 1);
                }
                const targetPath = this.resolveTargetPath(rootPath, item, container.artifactName, params.includeArtifactNameInPath);
                await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
                await withRetry(async () => {
                    this.context.logger.debug(`Downloading: ${targetPath}`);
                    if (item.blobMetadata && !this.disableBlobDownloadRequested()) {
                        const downloaded = await this.tryDownloadFromBlob(item, targetPath, workers, lookahead);
                        if (downloaded) {
                            telemetry.add('blobFiles');
                            return;
                        }
                    }
                    await this.downloadFromContainer(item, targetPath, params.retryDownloadCount);
                    telemetry.add('containerFiles');
                }, {
                    retries: params.retryDownloadCount,
                    signal: this.context.signal,
                    shouldRetry: error => error instanceof Error && (error as NodeJS.ErrnoException | undefined)?.name !== 'AbortedError',
                    onRetry: (error, attempt) => this.context.logger.warning(`Download attempt ${attempt} failed, retrying: ${errorMessage(error)}`)
                });
            }, this.context.signal);
        } finally {
            lookahead?.stop();
        }

        telemetry.add('containerArtifacts');
        telemetry.add('files', files.length);
        telemetry.add('bytes', files.reduce((sum, item) => sum + fileLengthOf(item), 0));

        if (params.checkDownloadedFiles) {
            await this.checkDownloads(items, rootPath, container.artifactName, params.includeArtifactNameInPath);
        }
    }

    private async startUrlLookahead(files: FileContainerItem[]): Promise<UrlLookahead | undefined> {
        const first = files.find(item => item.blobMetadata);
        if (!first || this.disableBlobDownloadRequested()) {
            return undefined;
        }
        try {
            const reader = await this.getBlobReader(first.blobMetadata!.artifactHash);
            if (!reader) {
                return undefined;
            }
            const { domainId } = artifactHashParts(first.blobMetadata!.artifactHash);
            return startFileLookahead(reader, files.length, index => {
                const metadata = files[index].blobMetadata;
                if (!metadata) {
                    return undefined;
                }
                try {
                    const parts = artifactHashParts(metadata.artifactHash);
                    return parts.domainId === domainId ? parts.dedupId : undefined;
                } catch {
                    // An invalid hash is reported by the download of that file.
                    return undefined;
                }
            });
        } catch {
            // The blob store cannot be reached: fall back to the container service, with the usual warning.
            this.disableBlobDownload();
            return undefined;
        }
    }

    private disableBlobDownloadRequested(): boolean {
        if (this.blob.disabled) {
            return true;
        }
        const lookup = this.context.getVariable;
        const value = lookup?.('DISABLE_BUILD_ARTIFACTS_TO_BLOB') ?? process.env.DISABLE_BUILD_ARTIFACTS_TO_BLOB;
        return asBoolean(value);
    }

    private disableBlobDownload(): void {
        const warningHost = this.blob.location ? new URL(this.blob.location.baseUrl).host : new URL(this.context.collectionUri).host;
        const allowListLink = DEFAULT_ALLOWLISTS[process.platform] ?? 'https://aka.ms/adoallowlist';
        this.context.logger.warning(this.loc(
            'BlobStoreDownloadWarning',
            'Artifact download from Blobstore failed, falling back to TFS. This will reduce download performance. Check that access to %s is allowed by your firewall rules. Please ensure your agent firewall is configured properly: %s',
            warningHost,
            allowListLink));
        this.blob.disabled = true;
        this.blob.readers.clear();
        telemetry.add('blobStoreFallbacks');
    }

    private async tryDownloadFromBlob(item: FileContainerItem, targetPath: string, workers?: BlobWorkerPool, lookahead?: UrlLookahead): Promise<boolean> {
        try {
            const reader = await this.getBlobReader(item.blobMetadata!.artifactHash);
            if (!reader) {
                return false;
            }
            await this.downloadFileFromBlob(item, targetPath, reader, workers);
            return true;
        } catch (error) {
            if (this.context.signal?.aborted) {
                throw error;
            }
            // The first file that finds the blob store failing disables it for all files. The container service has the same file, so no
            // retries are spent on the blob store.
            if (!this.blob.disabled) {
                this.disableBlobDownload();
            }
            lookahead?.stop();
            return false;
        }
    }

    private async getBlobReader(artifactHash: string): Promise<BlobReader | undefined> {
        const { domainId } = artifactHashParts(artifactHash);
        let reader = this.blob.readers.get(domainId);
        if (reader) {
            return reader;
        }

        this.blob.location ??= await discoverBlobStore(this.context.http, this.context.collectionUri);
        this.blob.settings ??= await getClientSettings(this.context.http, this.blob.location.baseUrl, 'BuildArtifact', this.context.logger);

        reader = new BlobReader({
            transport: new DedupTransport({
                http: this.context.http,
                location: this.blob.location,
                domainId
            }),
            http: this.context.http,
            logger: this.context.logger,
            concurrency: this.context.dedupParallelism ?? this.blob.settings.maxParallelism ?? 192,
            signal: this.context.signal
        });
        this.blob.readers.set(domainId, reader);
        return reader;
    }

    private async downloadFileFromBlob(item: FileContainerItem, destinationPath: string, reader: BlobReader, workers?: BlobWorkerPool): Promise<void> {
        const metadata = item.blobMetadata!;
        const { dedupId } = artifactHashParts(metadata.artifactHash);
        if ((metadata.compressionType ?? '').toLowerCase() === GZIP.toLowerCase()) {
            await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
            await pipeline(Readable.from(this.blobParts(reader, dedupId), { objectMode: false }), zlib.createGunzip(), fs.createWriteStream(destinationPath));
            return;
        }

        await downloadBlobToFile(reader, { id: dedupId, size: fileLengthOf(item) } as BlobRef, destinationPath, 32, this.context.signal, this.chunkBudget, workers);
    }

    private async* blobParts(reader: BlobReader, dedupId: string): AsyncGenerator<Buffer> {
        if (isChunkId(dedupId)) {
            yield await reader.getBlob(dedupId, undefined);
            return;
        }
        const leaves = await reader.leaves(await this.getBlobRef(reader, dedupId));
        // Chunks are decompressed in order; the ones that follow are downloaded ahead, within the shared budget.
        const ahead = Math.max(1, Math.min(GZIP_PREFETCH_CHUNKS, reader.concurrency ?? GZIP_PREFETCH_CHUNKS));
        yield* readChunksInOrder(reader, leaves, this.chunkBudget, ahead);
    }

    private async getBlobRef(reader: BlobReader, dedupId: string): Promise<BlobRef> {
        if (isChunkId(dedupId)) {
            const data = await reader.getBlob(dedupId, undefined);
            return { id: dedupId, size: data.length };
        }
        if (!isNodeId(dedupId)) {
            throw new ArtifactError(`Invalid artifact hash: ${dedupId}`);
        }
        const children = await reader.getNodeChildren(dedupId);
        return { id: dedupId, size: children.reduce((sum, child) => sum + child.size, 0) };
    }

    private async downloadFromContainer(item: FileContainerItem, destinationPath: string, retries: number): Promise<void> {
        const url = item.contentLocation;
        if (!url) {
            throw new ArtifactError(`The container item '${item.path}' has no content location.`);
        }
        const response = await this.context.http.requestStream(url, {
            retries: Math.max(0, retries),
            deadlineMs: downloadDeadlineMs(fileLengthOf(item)),
            signal: this.context.signal
        });
        await streamToFile(response.stream, response.headers['content-encoding'], destinationPath);
    }

    private async checkDownloads(items: FileContainerItem[], rootPath: string, artifactName: string, includeArtifactName: boolean): Promise<void> {
        this.context.logger.info(this.loc('BeginArtifactItemsIntegrityCheck', 'Starting artifact items integrity check'));
        const corrupted: FileContainerItem[] = [];
        for (const item of items.filter(itemIsFile)) {
            const targetPath = this.resolveTargetPath(rootPath, item, artifactName, includeArtifactName);
            const stat = await fs.promises.stat(targetPath);
            if (stat.size !== fileLengthOf(item)) {
                corrupted.push(item);
            }
        }
        if (corrupted.length > 0) {
            this.context.logger.warning(this.loc('CorruptedArtifactItemsList', 'The following items did not pass the integrity check:'));
            for (const item of corrupted) {
                this.context.logger.warning(item.itemLocation ?? item.path);
            }
            throw new IntegrityError(this.loc('IntegrityCheckNotPassed', 'Artifact items integrity check failed'));
        }
        this.context.logger.info(this.loc('IntegrityCheckPassed', 'Artifact items integrity check successfully finished'));
    }

    private async extractTarsIfPresent(fileArtifactPaths: string[], rootPath: string, extractedTarsTempPath: string, validateLinks: boolean): Promise<void> {
        this.context.logger.info(this.loc('TarSearchStart', 'Starting to search for tar archives to extract'));
        // The extension check is case sensitive, as in the agent plugin.
        const tarFiles = fileArtifactPaths.filter(file => file.endsWith('.tar'));
        if (tarFiles.length === 0) {
            this.context.logger.warning(this.loc('TarsNotFound', 'No tar archives were found to extract'));
            return;
        }

        await fs.promises.rm(extractedTarsTempPath, { recursive: true, force: true }).catch(() => undefined);
        for (const tarFile of tarFiles) {
            const relative = path.relative(path.resolve(rootPath), path.resolve(path.dirname(tarFile)));
            const destination = relative && relative !== '.'
                ? path.join(extractedTarsTempPath, relative)
                : extractedTarsTempPath;
            await this.extractTar(tarFile, destination);
            if (validateLinks) {
                await this.assertExtractedLinksInside(destination, tarFile, extractedTarsTempPath);
            }
            await fs.promises.unlink(tarFile);
        }

        this.context.logger.info(this.loc('TarsFound', 'Found %s tar archives to extract', tarFiles.length));
        const targetDirectory = path.join(rootPath, TAR_DIRECTORY);
        await fs.promises.mkdir(targetDirectory, { recursive: true });
        await this.moveDirectoryContents(extractedTarsTempPath, targetDirectory);
    }

    private async assertExtractedLinksInside(destination: string, tarFile: string, extractedTarsTempPath: string): Promise<void> {
        try {
            await assertLinksInside(destination);
        } catch (error) {
            await fs.promises.rm(extractedTarsTempPath, { recursive: true, force: true }).catch(() => undefined);
            await fs.promises.rm(tarFile, { force: true }).catch(() => undefined);
            throw error;
        }
    }

    private async extractTar(tarArchivePath: string, extractedFilesDir: string): Promise<void> {
        this.context.logger.info(this.loc('TarExtraction', 'Extracting tar archive: %s', tarArchivePath));
        await fs.promises.mkdir(extractedFilesDir, { recursive: true });
        let stderr = '';
        let failed = false;
        try {
            ({ stderr } = await execFileAsync('tar', ['xf', tarArchivePath, '--directory', extractedFilesDir]));
        } catch (error) {
            stderr = (error as { stderr?: string } | undefined)?.stderr ?? '';
            failed = true;
        }
        // Like the agent plugin, any output on stderr fails the extraction, even when tar exits with zero.
        if (failed || stderr.length !== 0) {
            throw new ArtifactError(this.loc('TarExtractionError', 'Failed to extract tar archive %s: %s', tarArchivePath, stderr));
        }
    }

    private async moveDirectoryContents(source: string, destination: string): Promise<void> {
        if (!fs.existsSync(source)) {
            return;
        }
        for (const entry of await fs.promises.readdir(source, { withFileTypes: true })) {
            const from = path.join(source, entry.name);
            const to = path.join(destination, entry.name);
            if (entry.isDirectory()) {
                await fs.promises.mkdir(to, { recursive: true });
                await this.moveDirectoryContents(from, to);
                await fs.promises.rmdir(from).catch(() => undefined);
            } else {
                await fs.promises.mkdir(path.dirname(to), { recursive: true });
                await moveFile(from, to);
            }
        }
    }
}
