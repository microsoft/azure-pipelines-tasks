"use strict"

import tl = require("azure-pipelines-task-lib/task");
import toolLib = require("azure-pipelines-tool-lib/tool");
import * as path from 'path';
import fs = require('fs');
import webclient = require("azure-arm-rest-v2/webClient");
import * as os from "os";
import * as util from "util";

const buildctlToolName = "buildctl"
const uuidV4 = require('uuid/v4');
const buildctlLatestReleaseUrl = "https://api.github.com/repos/moby/buildkit/releases/latest";
const stableBuildctlVersion = "v0.5.1"

export async function getBuildctlVersion(): Promise<string> {
    let buildctlVersion = tl.getInput("buildctlVersion");
    if(buildctlVersion && buildctlVersion != "latest") {
        return sanitizeVersionString(buildctlVersion.trim());
    }
    return await getStableBuildctlVersion();
}

async function getStableBuildctlVersion(): Promise<string> {
    var request = new webclient.WebRequest();
    request.uri = buildctlLatestReleaseUrl;
    request.method = "GET";

    try {
        var response = await webclient.sendRequest(request);
        return response.body["tag_name"];
    } catch (error) {
        tl.warning(tl.loc("BuildctlLatestNotKnown", buildctlLatestReleaseUrl, error, stableBuildctlVersion));
    }

    return stableBuildctlVersion;
}
export async function downloadBuildctl(version: string): Promise<string> {
    var cachedToolpath = toolLib.findLocalTool(buildctlToolName, version);
    let buildctlDownloadPath: string = null;
    if (!cachedToolpath) {
        try {
            buildctlDownloadPath = await toolLib.downloadTool(getBuildctlDownloadURL(version), buildctlToolName + "-" + version + "-" + uuidV4() + getArchiveExtension());
        } catch (exception) {
            throw new Error(tl.loc("BuildctlDownloadFailed", getBuildctlDownloadURL(version), exception));
        }

        var unzipedBuildctlPath = await toolLib.extractTar(buildctlDownloadPath);
        unzipedBuildctlPath = path.join(unzipedBuildctlPath, "bin", buildctlToolName);
        tl.debug('Extracting archive: ' + unzipedBuildctlPath+' download path: '+buildctlDownloadPath);
        var cachedToolpath = await toolLib.cacheFile(unzipedBuildctlPath, buildctlToolName, buildctlToolName, version);
        tl.debug('CachedTool path: ' + cachedToolpath);    
    }

    var buildctlpath = findBuildctl(cachedToolpath);
    if (!buildctlpath) {
        throw new Error(tl.loc("BuildctlNotFoundInFolder", cachedToolpath))
    }
    tl.debug('Buildctl path: ' + buildctlpath);
    fs.chmodSync(buildctlpath, "777");
    return buildctlpath;
}

function getBuildctlDownloadURL(version: string): string {
    switch (os.type()) {
        case 'Windows_NT':
            return util.format("https://github.com/moby/buildkit/releases/download/%s/buildkit-%s.windows-amd64.tar.gz", version, version);

        case 'Darwin':
            return util.format("https://github.com/moby/buildkit/releases/download/%s/buildkit-%s.darwin-amd64.tar.gz", version, version);

        default:
            case 'Linux':
                return util.format("https://github.com/moby/buildkit/releases/download/%s/buildkit-%s.linux-amd64.tar.gz", version, version);

    }
}

export async function getBuildKitPod(): Promise<string> {

    var consistenthashkey = tl.getVariable('Build.Repository.Name')+tl.getInput("dockerFile", true);
    var kubectlToolPath = tl.which("kubectl", true);
    var kubectlTool = tl.tool(kubectlToolPath);
    kubectlTool.arg('get');
    kubectlTool.arg('services');
    kubectlTool.arg('k8s-poolprovider');
    kubectlTool.arg('-n=azuredevops');
    kubectlTool.arg('-o=json');
    var serviceResponse= kubectlTool.execSync();
        
    //console.log("PodName: "+ JSON.parse(serviceResponse.stdout).status.loadBalancer.ingress[0].ip);
    var clusteruri = "http://"+JSON.parse(serviceResponse.stdout).status.loadBalancer.ingress[0].ip+":8082/consistenthash";
    let request = new webclient.WebRequest();
        
    request.uri = clusteruri;
    let headers = {
        "key": consistenthashkey
    };
    request.headers = headers
    request.method = "GET";
        
    //console.log("Get releases request: " + JSON.stringify(request));

    let webRequestOptions:webclient.WebRequestOptions = {retriableErrorCodes: [], retriableStatusCodes: [], retryCount: 1, retryIntervalInSeconds: 5, retryRequestTimedout: true};
    var response = await webclient.sendRequest(request, webRequestOptions);
    //console.log(response.body);
    var podname = response.body.Message;
    return podname;
}

function findBuildctl(rootFolder: string) {
    var DockerPath = path.join(rootFolder,  buildctlToolName);
    tl.debug('inside findBuildctl path: ' + DockerPath);   
    var allPaths = tl.find(rootFolder);
    var matchingResultsFiles = tl.match(allPaths, DockerPath, rootFolder);
    return matchingResultsFiles[0];
}

// handle user input scenerios
export function sanitizeVersionString(inputVersion: string) : string{
    var version = toolLib.cleanVersion(inputVersion);
    if(!version) {
        throw new Error(tl.loc("NotAValidSemverVersion"));
    }
    
    return "v"+version;
}

function getArchiveExtension(): string {
    if(os.type() == 'Windows_NT') {
        return ".zip";
    }
    return ".tar.gz";
}