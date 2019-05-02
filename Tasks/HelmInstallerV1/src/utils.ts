"use strict";

import tl = require('vsts-task-lib/task');
import * as toolLib from 'vsts-task-tool-lib/tool';
import helmutility = require("utility-common/helmutility");

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
export function sanitizeVersionString(inputVersion: string) : string{
    var version = toolLib.cleanVersion(inputVersion);
    if(!version) {
        throw new Error(tl.loc("NotAValidSemverVersion"));
    }
    
    return "v"+version;
}