import { BuildArtifact } from '../build/buildClient';
import { ArtifactError, IntegrityError } from '../errors';
import { DEFAULT_DOMAIN_ID, DedupTransport, discoverBlobStore, getClientSettings, BlobStoreClientSettings, BlobStoreLocation } from '../dedup/blobStore';
import { BlobReader } from '../dedup/blobReader';
import { downloadManifestArtifact } from '../dedup/download';
import { normalizeDedupId } from '../dedup/hashing';
import { isTransientError } from '../http/httpClient';
import { withRetry } from '../util/concurrency';
import { DEFAULT_MATCH_OPTIONS } from '../util/patterns';
import { ArtifactDownloadParameters, ArtifactProvider, ArtifactResourceTypes, ProviderContext } from './types';

const DOMAIN_ID_PROPERTY = 'DomainId';

/** A whole download is repeated only for network trouble, server errors and corrupted transfers: invalid manifests and unsafe paths fail immediately. */
function shouldRetryDownload(error: unknown): boolean {
    return error instanceof IntegrityError || isTransientError(error);
}

function propertyOf(artifact: BuildArtifact, name: string): string | undefined {
    const properties = artifact.resource.properties ?? {};
    const key = Object.keys(properties).find(candidate => candidate.toLowerCase() === name.toLowerCase());
    return key === undefined ? undefined : properties[key];
}

export class PipelineArtifactProvider implements ArtifactProvider {
    private location: Promise<BlobStoreLocation> | undefined;
    private settings: Promise<BlobStoreClientSettings> | undefined;

    constructor(private readonly context: ProviderContext) { }

    private getLocation(): Promise<BlobStoreLocation> {
        if (!this.location) {
            const pending = discoverBlobStore(this.context.http, this.context.collectionUri);
            pending.catch(() => { this.location = undefined; });
            this.location = pending;
        }
        return this.location;
    }

    private async createReader(domainId: string): Promise<BlobReader> {
        const logger = this.context.logger;
        const location = await this.getLocation();
        this.settings ??= getClientSettings(this.context.http, location.baseUrl, 'PipelineArtifact', logger);
        const settings = await this.settings;
        const parallelism = this.context.dedupParallelism ?? settings.maxParallelism ?? 192;
        logger.debug(`Max dedup parallelism: ${parallelism}`);
        logger.debug(`DomainId: ${domainId}`);
        return new BlobReader({
            transport: new DedupTransport({ http: this.context.http, location, domainId, logger }),
            http: this.context.http,
            logger,
            concurrency: parallelism,
            signal: this.context.signal
        });
    }

    private domainOf(artifact: BuildArtifact): string {
        // Artifacts published before multiple domains existed have no DomainId property: use the default domain.
        const value = propertyOf(artifact, DOMAIN_ID_PROPERTY);
        return value !== undefined && value.trim() !== '' ? value.trim() : DEFAULT_DOMAIN_ID;
    }

    async downloadSingleArtifact(params: ArtifactDownloadParameters, artifact: BuildArtifact): Promise<void> {
        const logger = this.context.logger;
        const reader = await this.createReader(this.domainOf(artifact));
        const manifestId = normalizeDedupId(artifact.resource.data, 'artifact manifest identifier');
        await withRetry(() => downloadManifestArtifact({
            reader,
            manifestId,
            targetDirectory: params.targetDirectory,
            patterns: params.minimatchFilters,
            matchOptions: params.customMinimatchOptions ?? DEFAULT_MATCH_OPTIONS,
            logger,
            signal: this.context.signal
        }), {
            retries: 3,
            signal: this.context.signal,
            shouldRetry: shouldRetryDownload,
            onRetry: (error, attempt) => logger.warning(`Download attempt ${attempt} failed, retrying: ${(error as Error).message}`)
        });
    }

    async downloadMultipleArtifacts(params: ArtifactDownloadParameters, artifacts: BuildArtifact[]): Promise<void> {
        const logger = this.context.logger;
        for (const artifact of artifacts) {
            const reader = await this.createReader(this.domainOf(artifact));
            const manifestId = normalizeDedupId(artifact.resource.data, 'artifact manifest identifier');
            logger.info(`Downloading artifact ${artifact.name}`);
            await withRetry(() => downloadManifestArtifact({
                reader,
                manifestId,
                targetDirectory: params.targetDirectory,
                subDirectory: artifact.name,
                matchPrefix: params.minimatchFilterWithArtifactName ? artifact.name : undefined,
                patterns: params.minimatchFilters,
                matchOptions: params.customMinimatchOptions ?? DEFAULT_MATCH_OPTIONS,
                logger,
                signal: this.context.signal
            }), {
                retries: 3,
                signal: this.context.signal,
                shouldRetry: shouldRetryDownload,
                onRetry: (error, attempt) => logger.warning(`Download attempt ${attempt} of ${artifact.name} failed, retrying: ${(error as Error).message}`)
            });
        }
    }
}

export class UnsupportedArtifactTypeError extends ArtifactError { }

export interface ArtifactProviders {
    pipelineArtifact: ArtifactProvider;
    container?: ArtifactProvider;
    fileShare?: ArtifactProvider;
}

export function getProvider(providers: ArtifactProviders, artifact: BuildArtifact): ArtifactProvider {
    const type = artifact.resource.type?.toLowerCase();
    if (type === ArtifactResourceTypes.PipelineArtifact.toLowerCase()) {
        return providers.pipelineArtifact;
    }
    if (type === ArtifactResourceTypes.Container.toLowerCase() && providers.container) {
        return providers.container;
    }
    if ((type === ArtifactResourceTypes.FilePath.toLowerCase() || type === ArtifactResourceTypes.FileShareArtifact) && providers.fileShare) {
        return providers.fileShare;
    }
    throw new UnsupportedArtifactTypeError(`The artifact '${artifact.name}' has the unsupported type '${artifact.resource.type}'.`);
}
