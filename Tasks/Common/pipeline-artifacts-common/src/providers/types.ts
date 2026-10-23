import { HttpClient } from '../http/httpClient';
import { Logger } from '../util/logger';
import { MatchOptions } from '../util/patterns';
import { BuildArtifact } from '../build/buildClient';

export const ArtifactResourceTypes = {
    PipelineArtifact: 'PipelineArtifact',
    Container: 'Container',
    FilePath: 'FilePath',
    // Name used by the property bag of file share artifacts published by PublishPipelineArtifact.
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
    extractedTarsTempPath?: string;
    appendArtifactNameToTargetPath: boolean;
}

export interface ProviderContext {
    http: HttpClient;
    collectionUri: string;
    logger: Logger;
    signal?: AbortSignal;
    dedupParallelism?: number;
    getVariable?: (name: string) => string | undefined;
    loc?: (key: string, ...args: unknown[]) => string;
}

export interface ArtifactProvider {
    downloadSingleArtifact(params: ArtifactDownloadParameters, artifact: BuildArtifact): Promise<void>;
    downloadMultipleArtifacts(params: ArtifactDownloadParameters, artifacts: BuildArtifact[]): Promise<void>;
}
