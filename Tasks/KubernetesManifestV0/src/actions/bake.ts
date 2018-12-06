"use strict";

import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require('fs');
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as os from "os";
import * as util from "util";
import { WebRequest, sendRequest, getTempDirectory } from "../utilities";
const uuidV4 = require('uuid/v4');
const helmToolName = "helm"
const helmLatestReleaseUrl = "https://api.github.com/repos/helm/helm/releases/latest";
const stableHelmVersion = "v2.9.1"

export async function bake() {
    let helmPath = await getHelm();
    let helmCommand = tl.tool(helmPath);
    helmCommand.arg("template");
    helmCommand.arg(tl.getPathInput("chart"))
    let args = tl.getDelimitedInput("overrides", "\n");
    helmCommand.arg(setArgs(args));
    var result = helmCommand.execSync();
    let pathToBakedManifest = getTemplatePath(result.stdout);
    tl.setVariable(tl.getInput("manifestsBundle"), pathToBakedManifest);
}

function getTemplatePath(data) {
    var paths = path.join(getTempDirectory(), "baked-template" + uuidV4() + ".yaml");
    fs.writeFileSync(paths, data)
    return paths;
}

function setArgs(args) {
    var newArgs = [];
    args.forEach(arg => {
        let a = arg.split(":");
        newArgs.push("--set")
        newArgs.push(a[0].trim() + "=" + a[1].trim());
    });
    return newArgs;
}

async function getHelm() {
    try {
        return Promise.resolve(tl.which("helm"));
    } catch (ex) {
        return downloadHelm();
    }
}

async function downloadHelm(): Promise<string> {
    let version = await getStableHelmVersion();
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

    fs.chmodSync(helmpath, "777");
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

        default:
        case 'Windows_NT':
            return util.format("https://storage.googleapis.com/kubernetes-helm/helm-%s-windows-amd64.zip", version);

    }
}

async function getStableHelmVersion(): Promise<string> {
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