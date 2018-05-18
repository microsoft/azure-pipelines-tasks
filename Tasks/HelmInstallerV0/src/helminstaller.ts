"use strict";

import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require('fs');
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as utils from './utils';
import * as os from "os";
import * as util from "util";
const uuidV4 = require('uuid/v4');
import downloadutility = require("utility-common/downloadutility");
const helmToolName = "helm"
const helmLatestReleaseUrl = "https://api.github.com/repos/kubernetes/helm/releases/latest";
const stableHelmVersion = "v2.8.2"

export async function getHelmVersion(): Promise<string> {
    var checkLatestHelmVersion = tl.getBoolInput('checkLatestHelmVersion', false); 
    if(checkLatestHelmVersion) {
        return await getStableHelmVersion();
    }

    return utils.sanitizeVersionString(tl.getInput("helmVersion", true));
}

export async function downloadHelm(version : string): Promise<string> {
    var cachedToolpath = toolLib.findLocalTool(helmToolName, version);
    if(!cachedToolpath) {
        try {
            var helmDownloadPath = await toolLib.downloadTool(getHelmDownloadURL(version), helmToolName + "-" + version + "-" + uuidV4() +".zip");
        } catch(exception) {
            throw new Error(tl.loc("HelmDownloadFailed", getHelmDownloadURL(version), exception));
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

async function getStableHelmVersion() : Promise<string>{
    var downloadPath = path.join(getTempDirectory(), uuidV4() +".json");
    var options = {
        hostname: 'api.github.com',
        port: 443,
        path: '/repos/kubernetes/helm/releases/latest',
        method: 'GET',
        secureProtocol: "TLSv1_2_method",
        headers: {
            'User-Agent' : 'vsts'
          }
    }

    try{
        await downloadutility.download(options, downloadPath, true);
        var version = await getReleaseVersion(downloadPath);
        return version;
    } catch(error) {
        tl.warning(tl.loc("HelmLatestNotKnown", helmLatestReleaseUrl, error, stableHelmVersion));
    }

    return stableHelmVersion;
}

function getExecutableExtention(): string {
    if(os.type().match(/^Win/)){
        return ".exe";
    }

    return "";
}

function getTempDirectory(): string {
    return tl.getVariable('agent.tempDirectory') || os.tmpdir();
}

function getReleaseVersion(jsonFilePath): Promise<string> {
    return new Promise(function (fulfill, reject){
        fs.readFile(jsonFilePath, {encoding: 'utf8'} ,function(err,data) {
            if(err) {
                reject(err);
            }
            var latestVersionInfo = JSON.parse(data);
            fulfill(latestVersionInfo.tag_name);
        })
    });
}