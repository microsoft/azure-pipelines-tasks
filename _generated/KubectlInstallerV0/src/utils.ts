"use strict"

import tl = require("azure-pipelines-task-lib/task");
import toolLib = require("azure-pipelines-tool-lib/tool");
import kubectlutility = require("azure-pipelines-tasks-kubernetes-common/kubectlutility");

export async function getKuberctlVersion(): Promise<string> {
    let kubectlVersion = tl.getInput("kubectlVersion");
    if(kubectlVersion && kubectlVersion != "latest") {
        return sanitizeVersionString(kubectlVersion.trim());
    }

    return await kubectlutility.getStableKubectlVersion();
}

export async function downloadKubectl(version : string): Promise<string> {
    return await kubectlutility.downloadKubectl(version);
}

// handle user input scenerios
export function sanitizeVersionString(inputVersion: string) : string{
    var version = toolLib.cleanVersion(inputVersion);
    if(!version) {
        throw new Error(tl.loc("NotAValidSemverVersion"));
    }
    
    return "v"+version;
}