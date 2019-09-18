"use strict";

import tl = require('azure-pipelines-task-lib/task');
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as functoolsutility from "func-tools-common/functoolsutility";

export async function getFuncToolsVersion(): Promise<string> {
    const version = tl.getInput("version");
    if (version && version != "latest") {
        return sanitizeVersionString(version);
    }

    console.log(tl.loc("FindingLatestFuncToolsVersion"));
    const latestVersion =  await functoolsutility.getLatestFuncToolsVersion();
    console.log(tl.loc("LatestFuncToolsVersion", latestVersion));
    return latestVersion;
}

export async function downloadFuncTools(version: string): Promise<string> {
    return await functoolsutility.downloadFuncTools(version);
}

// handle user input scenerios
function sanitizeVersionString(inputVersion: string) : string{
    const version = toolLib.cleanVersion(inputVersion);
    if(!version) {
        throw new Error(tl.loc("NotAValidSemverVersion"));
    }
    
    return version;
}