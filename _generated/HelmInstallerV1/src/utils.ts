"use strict";

import tl = require('azure-pipelines-task-lib/task');
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import helmutility = require("azure-pipelines-tasks-kubernetes-common/helmutility");

export async function getHelmVersion(): Promise<string> {
    let helmVersion = tl.getInput("helmVersionToInstall");
    if (helmVersion && helmVersion != "latest") {
        return sanitizeVersionString(helmVersion);
    }

    return await helmutility.getStableHelmVersion();
}

export async function downloadHelm(version: string): Promise<string> {
    return await helmutility.downloadHelm(version);
}

// handle user input scenerios
export function sanitizeVersionString(inputVersion: string): string {
    var version = toolLib.cleanVersion(inputVersion);
    if (!version) {
        throw new Error(tl.loc("NotAValidSemverVersion"));
    }

    return "v" + version;
}