import * as taskLib from 'azure-pipelines-task-lib/task';
import { STATUS, WARNING } from './constants';

// get artifact references from input or from previous docker push task
// through "RESOURCE_URIS" variable.
export function getArtifactReferences(): string[] {
    let artifactRefs = []
    const artifactRefsInput = taskLib.getInput('artifactRefs', false);
    if (!artifactRefsInput) {
        console.log(taskLib.loc('TryToGetArtifactRefsFromDockerTask'));
        artifactRefs = getArtifactReferencesFromDockerTask();
    } else {
        artifactRefs = artifactRefsInput.split(',').map((artifactRef) => artifactRef.trim());
    }

    if (artifactRefs.length === 0) {
        throw new Error(taskLib.loc('ArtifactRefsNotSpecified'));
    }

    // validate repeated artifact references
    let uniqueArtifactRefs = new Set<string>();
    for (const artifactRef of artifactRefs) {
        if (uniqueArtifactRefs.has(artifactRef)) {
            taskLib.warning(taskLib.loc('RepeatedArtifactRef', artifactRef));
            taskLib.setTaskVariable(STATUS, WARNING);
        } else {
            uniqueArtifactRefs.add(artifactRef);
        }
    }

    console.log(taskLib.loc('ArtifactRefs', artifactRefs));
    return Array.from(uniqueArtifactRefs);
}

// get artifact references from previous docker push task through 
// "RESOURCE_URIS" variable.
function getArtifactReferencesFromDockerTask(): string[] {
    const resourceURIs = taskLib.getVariable('RESOURCE_URIS');
    if (!resourceURIs) {
        return [];
    }

    let references = [];
    const resourceURIArray = resourceURIs.split(',');
    for (const uri of resourceURIArray) {
        const parts = uri.split('://');
        if (parts.length !== 2) {
            throw new Error(taskLib.loc('InvalidResourceURI', uri));
        }
        references.push(parts[1]);
    }
    return references;
}
