import * as tl from 'vsts-task-lib/task';

import {BuildArtifact} from 'vso-node-api/interfaces/BuildInterfaces';

import {ArtifactProvider} from './ArtifactProvider';

export class FilePathProvider implements ArtifactProvider {
    public supportsArtifactType(artifactType: string): boolean {
        return !!artifactType && artifactType.toLowerCase() === "filepath";
    }

    public async downloadArtifact(artifact: BuildArtifact, targetPath: string): Promise<void> {
        throw new Error(tl.loc("FilePathNotSupported"));
    }
}