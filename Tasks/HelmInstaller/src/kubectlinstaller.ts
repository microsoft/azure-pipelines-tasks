"use strict";

import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require('fs');
import * as toolLib from 'vsts-task-tool-lib/tool';

import kubectlutility = require("utility-common/kubectlutility");


export async function getKuberctlVersion(): Promise<string> {
    var defaultStableVersion = "v1.8.9";
    var checkLatestKubeCtl = tl.getBoolInput('checkLatestKubeCtl', false); 

    if(checkLatestKubeCtl) {
        return await kubectlutility.getStableKubectlVersion();
    }

    let kubectlVersion = tl.getInput("kubectlVersion");
    if(kubectlVersion) {
        return sanitizeVersionString(kubectlVersion);
    }

    return defaultStableVersion;
}

export async function downloadKubectl(version : string): Promise<string> {
     return await kubectlutility.downloadKubectl(version);
}

// handle user input scenerios
function sanitizeVersionString(kubectlVersion: string) : string{
    var version = toolLib.cleanVersion(kubectlVersion);
    if(!version) {
        throw new Error(tl.loc("NotAValidSemverVersion"));
    }
    
    return "v"+version;
}
