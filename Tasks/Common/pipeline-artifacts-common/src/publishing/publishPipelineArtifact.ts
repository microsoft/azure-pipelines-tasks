import { BuildClient } from '../build/buildClient';
import { DEFAULT_DOMAIN_ID, DedupTransport, discoverBlobStore, getClientSettings } from '../dedup/blobStore';
import { serializeHashType } from '../dedup/chunker';
import { prepareArtifact } from '../dedup/prepare';
import { DedupUploader, UploadStats } from '../dedup/uploader';
import { HttpClient } from '../http/httpClient';
import { withRetry } from '../util/concurrency';
import { Logger } from '../util/logger';

export const PipelineArtifactProperties = {
    RootId: 'RootId',
    ProofNodes: 'ProofNodes',
    ArtifactSize: 'artifactsize',
    HashType: 'HashType',
    DomainId: 'DomainId',
    CustomPropertiesPrefix: 'user-'
} as const;

const DEFAULT_DEDUP_PARALLELISM = 192;
const DEFAULT_ASSOCIATE_TIMEOUT_SECONDS = 900;

export interface PublishPipelineArtifactOptions {
    http: HttpClient;
    collectionUri: string;
    projectId: string;
    buildId: number;
    artifactName: string;
    jobId: string;
    sourcePath: string;
    properties?: Record<string, string>;
    domainOverride?: string;
    dedupParallelism?: number;
    /** Skip symbolic links (and junctions) that point outside of the source directory. By default every link is followed, as the agent plugin does. */
    skipExternalSymlinks?: boolean;
    associateTimeoutSeconds?: number;
    logger: Logger;
    signal?: AbortSignal;
}

export interface PublishPipelineArtifactResult {
    artifactId?: number;
    manifestId: string;
    rootId: string;
    contentSize: number;
    hashType: string;
    domainId: string;
    fileCount: number;
    upload: UploadStats;
}

export async function publishPipelineArtifact(options: PublishPipelineArtifactOptions): Promise<PublishPipelineArtifactResult> {
    const { logger } = options;

    const location = await discoverBlobStore(options.http, options.collectionUri);
    const settings = await getClientSettings(options.http, location.baseUrl, 'PipelineArtifact', logger);

    const overrideDomain = options.domainOverride?.trim();
    const domainId = overrideDomain || settings.defaultDomainId || DEFAULT_DOMAIN_ID;
    const hashType = settings.hashType ?? 'Dedup64K';
    const parallelism = options.dedupParallelism ?? settings.maxParallelism ?? DEFAULT_DEDUP_PARALLELISM;
    logger.info(`Max dedup parallelism: ${parallelism}`);
    logger.info(`DomainId: ${domainId}`);
    logger.info(`Hashtype: ${hashType}`);

    const prepared = await prepareArtifact({ sourcePath: options.sourcePath, hashType, logger, signal: options.signal, skipExternalSymlinks: options.skipExternalSymlinks });
    logger.info(`Prepared ${prepared.files.length} file(s), ${prepared.contentSize} bytes.`);

    const transport = new DedupTransport({ http: options.http, location, domainId, logger });
    const uploadConcurrency = Math.max(4, Math.min(48, Math.ceil(parallelism / 4)));
    const upload = await withRetry(() => new DedupUploader({ transport, prepared, logger, signal: options.signal, concurrency: uploadConcurrency }).upload(), {
        retries: 3,
        signal: options.signal,
        shouldRetry: () => true,
        onRetry: (error, attempt) => logger.warning(`Upload attempt ${attempt} failed, retrying: ${(error as Error).message}`)
    });

    const properties: Record<string, string> = {
        ...options.properties,
        [PipelineArtifactProperties.RootId]: prepared.superRoot.id,
        [PipelineArtifactProperties.ProofNodes]: JSON.stringify(prepared.proofs.map(node => node.toString('base64'))),
        [PipelineArtifactProperties.ArtifactSize]: String(prepared.contentSize),
        [PipelineArtifactProperties.HashType]: serializeHashType(hashType),
        [PipelineArtifactProperties.DomainId]: domainId
    };

    const timeoutMs = (options.associateTimeoutSeconds ?? DEFAULT_ASSOCIATE_TIMEOUT_SECONDS) * 1000;
    const client = new BuildClient(options.http, options.collectionUri);
    const artifact = await client.createArtifact(options.projectId, options.buildId, {
        name: options.artifactName,
        source: options.jobId,
        resource: { type: 'PipelineArtifact', data: prepared.manifestRoot.id, properties }
    }, timeoutMs, options.signal);

    logger.info(`Associated artifact ${artifact.id} with build ${options.buildId}`);
    return {
        artifactId: artifact.id,
        manifestId: prepared.manifestRoot.id,
        rootId: prepared.superRoot.id,
        contentSize: prepared.contentSize,
        hashType: serializeHashType(hashType),
        domainId,
        fileCount: prepared.files.length,
        upload
    };
}
