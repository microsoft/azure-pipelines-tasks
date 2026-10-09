import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as zlib from 'zlib';
import { execFile } from 'child_process';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { BuildArtifact } from '../build/buildClient';
import { ArtifactError, IntegrityError, errorMessage } from '../errors';
import { downloadBlobToFile } from '../dedup/download';
import { DEFAULT_DOMAIN_ID, DedupTransport, discoverBlobStore, getClientSettings } from '../dedup/blobStore';
import { BlobReader } from '../dedup/blobReader';
import { BlobRef, MAX_CHUNK_BYTES, isChunkId, isNodeId, normalizeDedupId } from '../dedup/hashing';
import { DEFAULT_DEADLINE_MS, contentDecoder } from '../http/httpClient';
import { forEachLimit, withRetry } from '../util/concurrency';
import { renameWithRetry } from '../util/files';
import { DEFAULT_MATCH_OPTIONS, MatchOptions, matchPaths } from '../util/patterns';
import { artifactPathSegments, resolveInside } from '../util/paths';
import { ArtifactDownloadParameters, ArtifactProvider, ProviderContext } from './types';

const CONTAINER_API_VERSION = '4.1-preview.4';
const TAR_DIRECTORY = 'extracted_tars';
const GZIP = 'GZip';
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

function trimTrailingSeparators(value: string): string {
    return value.replace(/[\\/]+$/, '');
}

function asBoolean(value: string | undefined): boolean {
    return /^true$/i.test(value ?? '');
}

function format(message: string, ...args: unknown[]): string {
    return util.format(message.replace(/%s/g, '%s'), ...args);
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

    constructor(protected readonly context: ProviderContext) { }

    async downloadSingleArtifact(params: ArtifactDownloadParameters, artifact: BuildArtifact): Promise<void> {
        const items = await this.getArtifactItems(params, artifact);
        await this.downloadArtifactItems(items, params, artifact, params.targetDirectory, true);

        if (params.extractTars) {
            const tarCandidates = items.filter(itemIsFile).map(item => this.resolveTargetPath(params.targetDirectory, item, this.parseContainerData(artifact.resource.data).artifactName, params.includeArtifactNameInPath));
            await this.extractTarsIfPresent(tarCandidates, params.targetDirectory, params.extractedTarsTempPath ?? path.join(params.targetDirectory, TAR_DIRECTORY));
        }
    }

    async downloadMultipleArtifacts(params: ArtifactDownloadParameters, artifacts: BuildArtifact[]): Promise<void> {
        const allFileArtifactPaths: string[] = [];

        for (const artifact of artifacts) {
            const artifactRoot = params.appendArtifactNameToTargetPath
                ? path.join(params.targetDirectory, artifact.name)
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
            await this.extractTarsIfPresent(allFileArtifactPaths, params.targetDirectory, params.extractedTarsTempPath ?? path.join(params.targetDirectory, TAR_DIRECTORY));
        }
    }

    private loc(key: string, fallback: string, ...args: unknown[]): string {
        if (this.context.loc) {
            return this.context.loc(key, ...args);
        }
        return format(fallback, ...args);
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

        await forEachLimit(items.filter(itemIsFile), Math.max(1, params.parallelizationLimit), async item => {
            const targetPath = this.resolveTargetPath(rootPath, item, container.artifactName, params.includeArtifactNameInPath);
            await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
            await withRetry(async () => {
                this.context.logger.debug(`Downloading: ${targetPath}`);
                if (item.blobMetadata && !this.disableBlobDownloadRequested()) {
                    const downloaded = await this.tryDownloadFromBlob(item, targetPath);
                    if (downloaded) {
                        return;
                    }
                }
                await this.downloadFromContainer(item, targetPath, params.retryDownloadCount);
            }, {
                retries: params.retryDownloadCount,
                signal: this.context.signal,
                shouldRetry: error => error instanceof Error && (error as NodeJS.ErrnoException | undefined)?.name !== 'AbortedError',
                onRetry: (error, attempt) => this.context.logger.warning(`Download attempt ${attempt} failed, retrying: ${errorMessage(error)}`)
            });
        }, this.context.signal);

        if (params.checkDownloadedFiles) {
            await this.checkDownloads(items, rootPath, container.artifactName, params.includeArtifactNameInPath);
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

    private async tryDownloadFromBlob(item: FileContainerItem, targetPath: string): Promise<boolean> {
        try {
            const reader = await this.getBlobReader(item.blobMetadata!.artifactHash);
            if (!reader) {
                return false;
            }
            await this.downloadFileFromBlob(item, targetPath, reader);
            return true;
        } catch (error) {
            if (!this.blob.disabled) {
                const warningHost = this.blob.location ? new URL(this.blob.location.baseUrl).host : new URL(this.context.collectionUri).host;
                const allowListLink = DEFAULT_ALLOWLISTS[process.platform] ?? 'https://aka.ms/adoallowlist';
                this.context.logger.warning(this.loc(
                    'BlobStoreDownloadWarning',
                    'Artifact download from Blobstore failed, falling back to TFS. This will reduce download performance. Check that access to %s is allowed by your firewall rules. Please ensure your agent firewall is configured properly: %s',
                    warningHost,
                    allowListLink));
                this.blob.disabled = true;
                this.blob.readers.clear();
                return false;
            }
            throw error;
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
                domainId,
                logger: this.context.logger
            }),
            http: this.context.http,
            logger: this.context.logger,
            concurrency: this.context.dedupParallelism ?? this.blob.settings.maxParallelism ?? 192,
            signal: this.context.signal
        });
        this.blob.readers.set(domainId, reader);
        return reader;
    }

    private async downloadFileFromBlob(item: FileContainerItem, destinationPath: string, reader: BlobReader): Promise<void> {
        const metadata = item.blobMetadata!;
        const { dedupId } = artifactHashParts(metadata.artifactHash);
        if ((metadata.compressionType ?? '').toLowerCase() === GZIP.toLowerCase()) {
            await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
            await pipeline(Readable.from(this.blobParts(reader, dedupId), { objectMode: false }), zlib.createGunzip(), fs.createWriteStream(destinationPath));
            return;
        }

        await downloadBlobToFile(reader, { id: dedupId, size: fileLengthOf(item) } as BlobRef, destinationPath, 32, this.context.signal);
    }

    private async* blobParts(reader: BlobReader, dedupId: string): AsyncGenerator<Buffer> {
        if (isChunkId(dedupId)) {
            yield await reader.getBlob(dedupId, undefined);
            return;
        }
        for (const leaf of await reader.leaves(await this.getBlobRef(reader, dedupId))) {
            yield await reader.getBlob(leaf.id, leaf.size, MAX_CHUNK_BYTES);
        }
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

    private async extractTarsIfPresent(fileArtifactPaths: string[], rootPath: string, extractedTarsTempPath: string): Promise<void> {
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
            await fs.promises.unlink(tarFile);
        }

        this.context.logger.info(this.loc('TarsFound', 'Found %s tar archives to extract', tarFiles.length));
        const targetDirectory = path.join(rootPath, TAR_DIRECTORY);
        await fs.promises.mkdir(targetDirectory, { recursive: true });
        await this.moveDirectoryContents(extractedTarsTempPath, targetDirectory);
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
                await renameWithRetry(from, to);
            }
        }
    }
}
