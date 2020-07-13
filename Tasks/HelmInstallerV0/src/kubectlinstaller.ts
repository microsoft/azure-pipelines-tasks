"use strict";

import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require('fs');

import kubectlutility = require("kubernetes-common/kubectlutility");
import * as utils from './utils';


export async function getKuberctlVersion(): Promise<string> {
    var checkLatestKubeCtl = tl.getBoolInput('checkLatestKubeCtl', false); 

    if(checkLatestKubeCtl) {
        return await kubectlutility.getStableKubectlVersion();
    }

    let kubectlVersion = tl.getInput("kubectlVersion");
    if(kubectlVersion) {
        return utils.sanitizeVersionString(kubectlVersion);
    }

    return kubectlutility.stableKubectlVersion;
}

export async function downloadKubectl(version : string): Promise<string> {
     return await kubectlutility.downloadKubectl(version);
}