"use strict";

import tl = require('azure-pipelines-task-lib/task');
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as functoolsutility from "func-tools-common/functoolsutility";

export async function getFuncToolsVersion(): Promise<string> {
    let version = tl.getInput("versionSpec");
    if (version && version != "latest") {
        return sanitizeVersionString(version);
    }

    console.log(tl.loc("FindingLatestFuncToolsVersion"));
    return await functoolsutility.getLatestFuncToolsVersion();
}

export async function downloadFuncTools(version: string): Promise<string> {
    console.log(tl.loc("DownloadingFuncTools", version));
    return await functoolsutility.downloadFuncTools(version);
}

// handle user input scenerios
function sanitizeVersionString(inputVersion: string) : string{
    var version = toolLib.cleanVersion(inputVersion);
    if(!version) {
        throw new Error(tl.loc("NotAValidSemverVersion"));
    }
    
    return version;
}