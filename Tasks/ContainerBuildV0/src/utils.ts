"use strict"

import tl = require("azure-pipelines-task-lib/task");
import toolLib = require("azure-pipelines-tool-lib/tool");
import * as tr from "azure-pipelines-task-lib/toolrunner";
import * as crypto from "crypto";
import * as path from 'path';
import fs = require('fs');
import webclient = require("azure-arm-rest-v2/webClient");
import * as os from "os";
import * as util from "util";

const buildctlToolName = "buildctl"
const uuidV4 = require('uuid/v4');
const buildctlLatestReleaseUrl = "https://api.github.com/repos/moby/buildkit/releases/latest";
const buildctlToolNameWithExtension = buildctlToolName + getExecutableExtension();
const stableBuildctlVersion = "v0.5.1"
var serviceName = "azure-pipelines-pool"
var namespace = "azuredevops"
var clusterip = ""

export async function getStableBuildctlVersion(): Promise<string> {
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

    let buildctlDownloadPath: string = null;
    var cachedToolpath = toolLib.findLocalTool(buildctlToolName, version);

    if (!cachedToolpath) {
        try {
            buildctlDownloadPath = await toolLib.downloadTool(getBuildctlDownloadURL(version), buildctlToolName + "-" + version + "-" + uuidV4() + getArchiveExtension());
        } catch (exception) {
            throw new Error(tl.loc("BuildctlDownloadFailed", getBuildctlDownloadURL(version), exception));
        }

        var unzipedBuildctlPath = await toolLib.extractTar(buildctlDownloadPath);
        unzipedBuildctlPath = path.join(unzipedBuildctlPath, "bin", buildctlToolNameWithExtension);

        tl.debug('Extracting archive: ' + unzipedBuildctlPath + ' download path: ' + buildctlDownloadPath);

        var cachedToolpath = await toolLib.cacheFile(unzipedBuildctlPath, buildctlToolNameWithExtension, buildctlToolName, version);

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

export async function getServiceDetails() {

    var kubectlToolPath = tl.which("kubectl", true);
    var kubectlTool = tl.tool(kubectlToolPath);
    
    kubectlTool.arg('get');
    kubectlTool.arg('service');
    kubectlTool.arg(`${serviceName}`);
    kubectlTool.arg('-o=json');

    var executionOption: tr.IExecOptions = <any>{
        silent: true
    };
    var serviceResponse = kubectlTool.execSync(executionOption);

    if (serviceResponse && serviceResponse.stderr) {
        throw new Error(serviceResponse.stderr);
    }
    else if (serviceResponse && serviceResponse.stdout) {
        var responseOutput = JSON.parse(serviceResponse.stdout);
        namespace = responseOutput.metadata.namespace ? responseOutput.metadata.namespace : namespace;
        clusterip = responseOutput.spec.clusterIP;
    }
}

export async function getBuildKitPod() {

        await getServiceDetails();

        var sharedsecret = tl.getInput('sharedSecret', false);
        var hmac = crypto.createHmac('sha512', sharedsecret);
        
        var hmacdigest = hmac.digest('hex');
        tl.debug("Computed hmac ");

        let request = new webclient.WebRequest();
        let headers = {
            "key": tl.getVariable('Build.Repository.Name') + tl.getInput("Dockerfile", true),
            "X-Azure-Signature": hmacdigest
        };
        let webRequestOptions: webclient.WebRequestOptions = { retriableErrorCodes: [], retriableStatusCodes: [], retryCount: 1, retryIntervalInSeconds: 5, retryRequestTimedout: true };

        request.uri = `http://${clusterip}/buildPod`;
        request.headers = headers
        request.method = "GET";

        var response = await webclient.sendRequest(request, webRequestOptions);
        var podname = response.body.Message;

        tl.debug("Podname " + podname);

        // set the environment variable
        process.env["BUILDKIT_HOST"] = "kube-pod://" + podname + "?namespace=" + namespace;
}

function findBuildctl(rootFolder: string) {

    var BuildctlPath = path.join(rootFolder, buildctlToolNameWithExtension);
    var allPaths = tl.find(rootFolder);
    var matchingResultsFiles = tl.match(allPaths, BuildctlPath, rootFolder);

    tl.debug('findBuildctl path: ' + BuildctlPath);

    return matchingResultsFiles[0];
}

function getArchiveExtension(): string {
    if (os.type() == 'Windows_NT') {
        return ".zip";
    }
    return ".tar.gz";
}

function getExecutableExtension(): string {
    if (os.type() == 'Windows_NT') {
        return ".exe";
    }
    return "";
}