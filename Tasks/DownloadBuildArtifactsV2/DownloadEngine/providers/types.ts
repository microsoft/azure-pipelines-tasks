import { HttpClient } from '../http/httpClient';
import { Logger } from '../util/logger';
import { MatchOptions } from '../util/patterns';
import { BuildArtifact } from '../build/buildClient';

export const ArtifactResourceTypes = {
    PipelineArtifact: 'PipelineArtifact',
    Container: 'Container',
    FilePath: 'FilePath',
    // Name used by the property bag of file share artifacts.
    FileShareArtifact: 'filepath'
} as const;

export interface ArtifactDownloadParameters {
    project: string;
    pipelineId: number;
    artifactName?: string;
    targetDirectory: string;
    minimatchFilters: string[];
    minimatchFilterWithArtifactName: boolean;
    includeArtifactNameInPath: boolean;
    parallelizationLimit: number;
    retryDownloadCount: number;
    checkDownloadedFiles: boolean;
    customMinimatchOptions?: MatchOptions;
    extractTars: boolean;
    /** Rejects an extracted archive that holds a symbolic link pointing outside of the folder it was extracted to. */
    validateTarSymlinks?: boolean;
    extractedTarsTempPath?: string;
    appendArtifactNameToTargetPath: boolean;
}

export interface ProviderContext {
    http: HttpClient;
    collectionUri: string;
    logger: Logger;
    signal?: AbortSignal;
    dedupParallelism?: number;
    /** The number of worker threads that verify and write blobs: undefined for the default of the machine, 0 for none. */
    workerThreads?: number;
    /** Whether the worker threads also download the blobs: undefined for the default of the machine (they do with more than two processors). */
    workerDownloads?: boolean;
    getVariable?: (name: string) => string | undefined;
    loc?: (key: string, ...args: unknown[]) => string;
}

export interface ArtifactProvider {
    downloadSingleArtifact(params: ArtifactDownloadParameters, artifact: BuildArtifact): Promise<void>;
    downloadMultipleArtifacts(params: ArtifactDownloadParameters, artifacts: BuildArtifact[]): Promise<void>;
}
