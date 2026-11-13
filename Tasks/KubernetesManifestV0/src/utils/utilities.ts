'use strict';

import * as tl from 'azure-pipelines-task-lib/task';
import { IExecSyncResult } from 'azure-pipelines-task-lib/toolrunner';
import * as kubectlutility from 'azure-pipelines-tasks-kubernetes-common/kubectlutility';
import { Kubectl } from 'azure-pipelines-tasks-kubernetes-common/kubectl-object-model';
import { pipelineAnnotations } from 'azure-pipelines-tasks-kubernetes-common/kubernetesconstants';
import { KubernetesConnection } from 'azure-pipelines-tasks-kubernetes-common/kubernetesconnection';
import * as filehelper from './FileHelper';

export function getManifestFiles(manifestFilePaths: string | string[]): string[] {
    if (!manifestFilePaths) {
        tl.debug('file input is not present');
        return null;
    }

    const files = tl.findMatch(tl.getVariable('System.DefaultWorkingDirectory') || process.cwd(), manifestFilePaths);
    return files;
}

export function getConnection(): KubernetesConnection {
    const kubernetesServiceConnection = tl.getInput('kubernetesServiceConnection', true);
    const tempPath = filehelper.getNewUserDirPath();
    const connection = new KubernetesConnection(kubernetesServiceConnection, tempPath);
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

export function escapeHelmSetToken(token: string, allowLists: boolean = false): string {
    if (tl.getPipelineFeature('KubernetesManifest.DisableStrictSetArguments')) {
        return token;
    }

    // Existing backslash escapes (for example \. in key paths) are preserved; only separators that
    // would start a new --set pair are escaped.
    // Commas stay active only when the whole token is a single flat Helm list: {a,b}.
    let isList = false;
    if (allowLists && token.length >= 2 && token[0] === '{') {
        // Helm treats additional '{' characters as item text, not nested lists.
        for (let i = 1; i < token.length; i++) {
            if (token[i] === '\\') { i++; continue; }
            if (token[i] === '}') {
                isList = i === token.length - 1;
                break;
            }
        }
    }

    let result = '';
    for (let i = 0; i < token.length; i++) {
        const c = token[i];
        if (c === '\\') {
            result += i + 1 < token.length ? c + token[++i] : '\\\\';
        } else if (c === ',' && !isList) {
            result += '\\,';
        } else if (c === '=' && !allowLists) {
            result += '\\=';
        } else {
            result += c;
        }
    }
    // A value starting with an unescaped '{' opens a Helm list, after which further keys can follow without a comma.
    return allowLists && !isList && result.startsWith('{') ? '\\' + result : result;
}

// Names and kinds read from manifests are joined into a kubectl command line, so they must stay a single
// token and must not be parseable as an option.
// Enabling the KubernetesManifest.DisableManifestObjectNameValidation pipeline feature restores the legacy behavior.
export function validateManifestObjectToken(value: any, description: string): string {
    if (tl.getPipelineFeature('KubernetesManifest.DisableManifestObjectNameValidation')) {
        return value;
    }

    const token = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
    if (typeof token !== 'string' || token.length === 0 || token.length > 253 ||
        token.startsWith('-') || /[\s\x00-\x1f\x7f"'`\\]/.test(token)) {
        throw new Error(tl.loc('InvalidManifestObjectToken', description));
    }
    return token;
}

export function validateReleaseName(value: string): string {
    if (value && value.startsWith('-')) {
        throw new Error(tl.loc('InvalidReleaseName', value));
    }
    return value;
}
