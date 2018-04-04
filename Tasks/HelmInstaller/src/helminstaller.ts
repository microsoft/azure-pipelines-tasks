"use strict";

import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require('fs');
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as utils from './utils';
import * as os from "os";
import * as util from "util";
const uuidV4 = require('uuid/v4');
const helmToolName = "helm"

export async function getHelmVersion(): Promise<string> {
    var defaultStableVersion = "v2.8.2";

    let helmVersion = tl.getInput("helmVersion");
    if(helmVersion) {
        return utils.sanitizeVersionString(helmVersion);
    }

    return defaultStableVersion;
}

export async function downloadHelm(version : string): Promise<string> {
     //
    var cachedToolpath = toolLib.findLocalTool(helmToolName, version);

    if(!cachedToolpath) {

        try {
            var helmDownloadPath = await toolLib.downloadTool(getHelmDownloadURL(version), helmToolName + "-" + version + "-" + uuidV4() +".zip");
        } catch(exception) {
            throw new Error(tl.loc("HelmDownloadFiled", getHelmDownloadURL(version), exception));
        }
        
        var unzipedHelmPath = await toolLib.extractZip(helmDownloadPath);
        cachedToolpath = await toolLib.cacheDir(unzipedHelmPath, helmToolName, version);
    }

    var helmpath = findHelm(cachedToolpath);

    if(!helmpath) {
        throw new Error(tl.loc("HelmNotFoundInFolder", cachedToolpath))
    }

    fs.chmod(helmpath, "777");
    return helmpath;
}   

function findHelm(rootFolder: string) {
    var helmPath = path.join(rootFolder, "*", helmToolName + getExecutableExtention());
    var allPaths = tl.find(rootFolder);
    var matchingResultsFiles = tl.match(allPaths, helmPath, rootFolder);
    return matchingResultsFiles[0];
}


function getHelmDownloadURL(version: string) : string {
    switch(os.type())
    {
        case 'Linux':
            return util.format("https://storage.googleapis.com/kubernetes-helm/helm-%s-linux-amd64.zip", version);

        case 'Darwin':
            return util.format("https://storage.googleapis.com/kubernetes-helm/helm-%s-darwin-amd64.zip", version);

        default:
        case 'Windows_NT':
            return util.format("https://storage.googleapis.com/kubernetes-helm/helm-%s-windows-amd64.zip", version);   

    }
}

function getExecutableExtention(): string {
    if(os.type().match(/^Win/)){
        return ".exe";
    }

    return "";
}