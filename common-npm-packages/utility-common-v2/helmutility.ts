import path = require('path');
import fs = require('fs');
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as os from "os";
import * as util from "util";
import { WebRequest, sendRequest } from "./restutilities";
import * as tl from "azure-pipelines-task-lib/task";

const uuidV4 = require('uuid/v4');
const helmToolName = "helm"
const helmLatestReleaseUrl = "https://api.github.com/repos/helm/helm/releases/latest";
const stableHelmVersion = "v2.9.1"

export async function getHelm(version?: string) {
    try {
        return Promise.resolve(tl.which("helm", true));
    } catch (ex) {
        return downloadHelm(version);
    }
}

export async function downloadHelm(version?: string): Promise<string> {
    if (!version) version = await getStableHelmVersion();
    var cachedToolpath = toolLib.findLocalTool(helmToolName, version);
    if (!cachedToolpath) {
        try {
            var helmDownloadPath = await toolLib.downloadTool(getHelmDownloadURL(version), helmToolName + "-" + version + "-" + uuidV4() + ".zip");
        } catch (exception) {
            throw new Error(tl.loc("HelmDownloadFailed", getHelmDownloadURL(version), exception));
        }
        var unzipedHelmPath = await toolLib.extractZip(helmDownloadPath);
        cachedToolpath = await toolLib.cacheDir(unzipedHelmPath, helmToolName, version);
    }

    var helmpath = findHelm(cachedToolpath);
    if (!helmpath) {
        throw new Error(tl.loc("HelmNotFoundInFolder", cachedToolpath))
    }

    fs.chmodSync(helmpath, "644");
    return helmpath;
}

function findHelm(rootFolder: string) {
    var helmPath = path.join(rootFolder, "*", helmToolName + getExecutableExtention());
    var allPaths = tl.find(rootFolder);
    var matchingResultsFiles = tl.match(allPaths, helmPath, rootFolder);
    return matchingResultsFiles[0];
}

function getHelmDownloadURL(version: string): string {
    switch (os.type()) {
        case 'Linux':
            return util.format("https://storage.googleapis.com/kubernetes-helm/helm-%s-linux-amd64.zip", version);

        case 'Darwin':
            return util.format("https://storage.googleapis.com/kubernetes-helm/helm-%s-darwin-amd64.zip", version);

        case 'Windows_NT':
            return util.format("https://storage.googleapis.com/kubernetes-helm/helm-%s-windows-amd64.zip", version);

        default:
            throw Error("Unknown OS type");
    }
}

export async function getStableHelmVersion(): Promise<string> {
    var request = new WebRequest();
    request.uri = "https://api.github.com/repos/helm/helm/releases/latest";
    request.method = "GET";

    try {
        var response = await sendRequest(request);
        return response.body["tag_name"];
    } catch (error) {
        tl.warning(tl.loc("HelmLatestNotKnown", helmLatestReleaseUrl, error, stableHelmVersion));
    }

    return stableHelmVersion;
}

function getExecutableExtention(): string {
    if (os.type().match(/^Win/)) {
        return ".exe";
    }
    return "";
} 