import { ArtifactEngineOptions } from 'artifact-engine/Engine';
import { BuildArtifact } from 'azure-devops-node-api/interfaces/BuildInterfaces';
import { PersonalAccessTokenCredentialHandler } from 'artifact-engine/Providers/typed-rest-client/Handlers';

export interface IBaseHandlerConfig {
    artifactInfo: BuildArtifact;
    downloadPath: string;
    downloaderOptions: ArtifactEngineOptions;
    checkDownloadedFiles: boolean;
}

export interface IContainerHandlerConfig extends IBaseHandlerConfig {
    endpointUrl: string;
    templatePath: string;
    handler: PersonalAccessTokenCredentialHandler;
}

export interface IContainerHandlerZipConfig extends IBaseHandlerConfig {
    endpointUrl: string;
    projectId: string;
    buildId: number;
    handler: PersonalAccessTokenCredentialHandler;
}
