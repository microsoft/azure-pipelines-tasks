"use strict";

import * as tl from "vsts-task-lib/task";
import { ToolRunner, IExecOptions, IExecSyncResult } from 'vsts-task-lib/toolrunner';
import kubectlutility = require("utility-common/kubectlutility");
import { Kubectl } from "utility-common/kubectl-object-model";
import { pipelineAnnotations } from "../models/constants"

export enum StringComparer {
    Ordinal, OrdinalIgnoreCase
}

export function execCommand(command: ToolRunner, options?: IExecOptions) {
    command.on("errline", tl.error);
    return command.execSync(options);
}

export async function getKubectl(): Promise<string> {
    try {
        return Promise.resolve(tl.which("kubectl", true));
    } catch (ex) {
        return kubectlutility.downloadKubectl(await kubectlutility.getStableKubectlVersion());
    }
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

export function annotateChildPods(kubectl: Kubectl, resourceType, resourceName, allPods): IExecSyncResult[] {
    let commandExecutionResults = [];
    var owner = resourceName;
    if (resourceType.indexOf("deployment") > -1) {
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

export function replaceAllTokens(currentString: string, replaceToken, replaceValue) {
    let i = currentString.indexOf(replaceToken);
    if (i < 0) {
        tl.debug(`No occurence of replacement token: ${replaceToken} found`);
        return currentString;
    }

    let newString = currentString.substring(0, i);
    let leftOverString = currentString.substring(i);
    newString += replaceValue + leftOverString.substring(Math.min(leftOverString.indexOf("\n"), leftOverString.indexOf("\"")));
    if (newString == currentString) {
        tl.debug(`All occurences replaced`);
        return newString;
    }
    return replaceAllTokens(newString, replaceToken, replaceValue);
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
