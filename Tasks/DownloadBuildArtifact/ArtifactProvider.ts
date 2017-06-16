import {BuildArtifact} from 'vso-node-api/interfaces/BuildInterfaces';

export interface ArtifactProvider {
    supportsArtifactType(artifactType: string): boolean;
    downloadArtifact(artifact: BuildArtifact, targetPath: string): Promise<void>;
}