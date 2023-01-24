import * as toolLib from 'azure-pipelines-tool-lib/tool';
import { INodeVersion } from '../models/INodeVersion';

export function getSupportedNodeVersions(nodeVersions: INodeVersion[], dataFileName: string) {
    const versions: string[] = [];

    for (const nodeVersion of nodeVersions) {

        // ensure this version supports your os and platform
        if (nodeVersion.files.indexOf(dataFileName) >= 0) {

            // versions in the file are prefixed with 'v', which is not valid SemVer
            // remove 'v' so that toolLib.evaluateVersions behaves properly
            nodeVersion.semanticVersion = toolLib.cleanVersion(nodeVersion.version);
            versions.push(nodeVersion.semanticVersion);
        }
    }

    return versions;
}
