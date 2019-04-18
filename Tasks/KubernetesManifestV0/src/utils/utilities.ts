"use strict";

import * as tl from "vsts-task-lib/task";
import { IExecSyncResult } from 'vsts-task-lib/toolrunner';
import kubectlutility = require("utility-common/kubectlutility");
import { Kubectl } from "kubernetes-common/kubectl-object-model";
import { pipelineAnnotations } from "../models/constants"

export enum StringComparer {
    Ordinal, OrdinalIgnoreCase
}

export function getManifestFiles(manifestFilesPath: string): string[] {
    if (!manifestFilesPath || manifestFilesPath.trim().length == 0) {
        tl.debug("file input is not present");
        return null;
    }

    var files = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory") || process.cwd(), manifestFilesPath.trim());
    return files;
}

export async function getKubectl(): Promise<string> {
    try {
        return Promise.resolve(tl.which("kubectl", true));
    } catch (ex) {
        return kubectlutility.downloadKubectl(await kubectlutility.getStableKubectlVersion());
    }
}

export function createKubectlArgs(kinds: Set<string>, names: Set<string>): string {
    let args = "";
    if (!!kinds && kinds.size > 0) {
        args = args + createInlineArray(Array.from(kinds.values()));
    }

    if (!!names && names.size > 0) {
        args = args + " " + Array.from(names.values()).join(" ")
    }

    return args;
}

export function getDeleteCmdArgs(argsPrefix: string, inputArgs: string): string {
    let args = "";

    if (!!argsPrefix && argsPrefix.length > 0) {
        args = argsPrefix;
    }

    if (!!inputArgs && inputArgs.length > 0) {
        if (args.length > 0) {
            args = args + " ";
        }

        args = args + inputArgs;
    }

    return args;
}

export function checkForErrors(execResults: IExecSyncResult[], warnIfError?: boolean) {
    if (execResults.length != 0) {
        var stderr = "";
        execResults.forEach(result => {
            if (result.stderr) {
                stderr += result.stderr + "\n";
            }
        });
        if (stderr.length > 0) {
            if (!!warnIfError)
                tl.warning(stderr.trim());
            else {
                throw new Error(stderr.trim());
            }
        }
    }
}

export function annotateChildPods(kubectl: Kubectl, resourceType: string, resourceName: string, allPods): IExecSyncResult[] {
    let commandExecutionResults = [];
    var owner = resourceName;
    if (resourceType.toLowerCase().indexOf("deployment") > -1) {
        owner = kubectl.getNewReplicaSet(resourceName);
    }

    if (!!allPods && !!allPods["items"] && allPods["items"].length > 0) {
        allPods["items"].forEach((pod) => {
            let owners = pod["metadata"]["ownerReferences"];
            if (!!owners) {
                owners.forEach(ownerRef => {
                    if (ownerRef["name"] == owner) {
                        commandExecutionResults.push(kubectl.annotate("pod", pod["metadata"]["name"], pipelineAnnotations, true));
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
    let i = currentString.indexOf(imageName);
    if (i < 0) {
        tl.debug(`No occurence of replacement token: ${imageName} found`);
        return currentString;
    }

    let newString = "";
    currentString.split("\n")
        .forEach((line) => {
            if (line.indexOf(imageName) > 0 && line.toLocaleLowerCase().indexOf("image") > 0) {
                let i = line.indexOf(imageName);
                newString += line.substring(0, i);
                let leftOverString = line.substring(i);
                if (leftOverString.endsWith("\"")) {
                    newString += imageNameWithNewTag + "\"" + "\n";
                } else {
                    newString += imageNameWithNewTag + "\n";
                }
            }
            else {
                newString += line + "\n";
            }
        });

    return newString;
}

export function isEqual(str1: string, str2: string, stringComparer: StringComparer): boolean {

    if (str1 == null && str2 == null) {
        return true;
    }

    if (str1 == null) {
        return false;
    }

    if (str2 == null) {
        return false;
    }

    if (stringComparer == StringComparer.OrdinalIgnoreCase) {
        return str1.toUpperCase() === str2.toUpperCase();
    } else {
        return str1 === str2;
    }
}

function createInlineArray(str: string | string[]): string {
    if (typeof str === "string") return str;
    return str.join(",");
}
