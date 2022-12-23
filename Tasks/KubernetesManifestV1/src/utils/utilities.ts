'use strict';

import * as tl from 'azure-pipelines-task-lib/task';
import { IExecSyncResult } from 'azure-pipelines-task-lib/toolrunner';
import { Kubectl } from 'azure-pipelines-tasks-kubernetes-common-v2/kubectl-object-model';
import * as kubectlutility from 'azure-pipelines-tasks-kubernetes-common-v2/kubectlutility';
import { pipelineAnnotations } from 'azure-pipelines-tasks-kubernetes-common-v2/kubernetesconstants';
import ClusterConnection from './ClusterConnection';
import * as filehelper from './FileHelper';

export function getManifestFiles(manifestFilePaths: string | string[]): string[] {
    if (!manifestFilePaths) {
        tl.debug('file input is not present');
        return null;
    }

    const files = tl.findMatch(tl.getVariable('System.DefaultWorkingDirectory') || process.cwd(), manifestFilePaths);
    return files;
}

export function getConnection(): ClusterConnection {
    const tempPath = filehelper.getNewUserDirPath();
    const connection = new ClusterConnection(tempPath);
    return connection;
}

export async function getKubectl(): Promise<string> {
    try {
        return Promise.resolve(tl.which('kubectl', true));
    } catch (ex) {
        return kubectlutility.downloadKubectl(await kubectlutility.getStableKubectlVersion());
    }
}

export function createKubectlArgs(kind: string, names: Set<string>): string {
    let args = '';
    if (!!kind) {
        args = args + kind;
    }

    if (!!names && names.size > 0) {
        args = args + ' ' + Array.from(names.values()).join(' ');
    }

    return args;
}

export function getDeleteCmdArgs(argsPrefix: string, inputArgs: string): string {
    let args = '';

    if (!!argsPrefix && argsPrefix.length > 0) {
        args = argsPrefix;
    }

    if (!!inputArgs && inputArgs.length > 0) {
        if (args.length > 0) {
            args = args + ' ';
        }

        args = args + inputArgs;
    }

    return args;
}

export function checkForErrors(execResults: IExecSyncResult[], warnIfError?: boolean) {
    if (execResults.length !== 0) {
        let stderr = '';
        execResults.forEach(result => {
            if (result.stderr) {
                if (result.code !== 0) {
                    stderr += result.stderr + '\n';
                } else {
                    tl.warning(result.stderr);
                }
            }
        });
        if (stderr.length > 0) {
            if (!!warnIfError) {
                tl.warning(stderr.trim());
            } else {
                throw new Error(stderr.trim());
            }
        }
    }
}

export function annotateChildPods(kubectl: Kubectl, resourceType: string, resourceName: string, allPods): IExecSyncResult[] {
    const commandExecutionResults = [];
    let owner = resourceName;
    if (resourceType.toLowerCase().indexOf('deployment') > -1) {
        owner = kubectl.getNewReplicaSet(resourceName);
    }

    if (!!allPods && !!allPods.items && allPods.items.length > 0) {
        allPods.items.forEach((pod) => {
            const owners = pod.metadata.ownerReferences;
            if (!!owners) {
                owners.forEach(ownerRef => {
                    if (ownerRef.name === owner) {
                        commandExecutionResults.push(kubectl.annotate('pod', pod.metadata.name, pipelineAnnotations, true));
                    }
                });
            }
        });
    }

    return commandExecutionResults;
}

/*
    For example,
        currentString: `image: "example/example-image"`
        imageName: `example/example-image`
        imageNameWithNewTag: `example/example-image:identifiertag`

    This substituteImageNameInSpecFile function would return
        return Value: `image: "example/example-image:identifiertag"`
*/

export function substituteImageNameInSpecFile(currentString: string, imageName: string, imageNameWithNewTag: string) {
    if (currentString.indexOf(imageName) < 0) {
        tl.debug(`No occurence of replacement token: ${imageName} found`);
        return currentString;
    }

    return currentString.split('\n').reduce((acc, line) => {
        const imageKeyword = line.match(/^ *image:/);
        if (imageKeyword) {
            let [currentImageName, currentImageTag] = line
                .substring(imageKeyword[0].length) // consume the line from keyword onwards
                .trim()
                .replace(/[',"]/g, '') // replace allowed quotes with nothing
                .split(':');

            if (!currentImageTag && currentImageName.indexOf(' ') > 0) {
                currentImageName = currentImageName.split(' ')[0]; // Stripping off comments
            }

            if (currentImageName === imageName) {
                return acc + `${imageKeyword[0]} ${imageNameWithNewTag}\n`;
            }
        }

        return acc + line + '\n';
    }, '');
}

export function getTrafficSplitAPIVersion(kubectl: Kubectl) {
    const result = kubectl.executeCommand('api-versions');
    const trafficSplitAPIVersion = result.stdout.split('\n').find(version => version.startsWith('split.smi-spec.io'));
    if (trafficSplitAPIVersion == null || typeof trafficSplitAPIVersion == 'undefined') {
        throw new Error(tl.loc('UnableToCreateTrafficSplitManifestFile', 'Could not find a valid api version for TrafficSplit object'));
    }
    tl.debug("api-version: " + trafficSplitAPIVersion);
    return trafficSplitAPIVersion;
}
