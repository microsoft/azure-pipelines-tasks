"use strict";

var https   = require('https');
var fs      = require('fs');
import * as path from "path";
import * as tl from "vsts-task-lib/task";
import * as os from "os";
import * as util from "util";

import downloadutility = require("utility-common/downloadutility");

export function getTempDirectory(): string {
    return os.tmpdir();
}

export function getCurrentTime(): number {
    return new Date().getTime();
}

export function getNewUserDirPath(): string {
    var userDir = path.join(getTempDirectory(), "kubectlTask");
    ensureDirExists(userDir);

    userDir = path.join(userDir, getCurrentTime().toString());
    ensureDirExists(userDir);

    return userDir;
} 

function ensureDirExists(dirPath : string) : void
{
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
    }
}

export async function getStableKubectlVersion() : Promise<string> {
    var stableVersion = "v1.6.6";
    var version;
    var stableVersionUrl = "https://storage.googleapis.com/kubernetes-release/release/stable.txt";
    var downloadPath = path.join(getTempDirectory(), getCurrentTime().toString()+".txt");
    await downloadutility.download(stableVersionUrl, downloadPath);
    tl.debug(tl.loc('DownloadPathForStableTxt', downloadPath));
    version = fs.readFileSync(downloadPath, "utf8").toString().trim();
    if(!version){
        version = stableVersion;
    }
    return version;
}

export async function downloadKubectl(version: string, kubectlPath: string): Promise<void> {
    var kubectlURL = getkubectlDownloadURL(version);
    tl.debug(tl.loc('DownloadingKubeCtlFromUrl', kubectlURL));
    var kubectlPathTmp = kubectlPath+".tmp";
    await downloadutility.download(kubectlURL, kubectlPathTmp);
    tl.cp(kubectlPathTmp, kubectlPath, "-f");
    fs.chmod(kubectlPath, "777");
    assertFileExists(kubectlPath);
}

function getkubectlDownloadURL(version: string) : string {
    switch(os.type())
    {
        case 'Linux':
            return util.format("https://storage.googleapis.com/kubernetes-release/release/%s/bin/linux/amd64/kubectl", version);

        case 'Darwin':
            return util.format("https://storage.googleapis.com/kubernetes-release/release/%s/bin/darwin/amd64/kubectl", version);

        default:
        case 'Windows_NT':
            return util.format("https://storage.googleapis.com/kubernetes-release/release/%s/bin/windows/amd64/kubectl.exe", version);   

    }
}

function assertFileExists(path: string) {
    if(!fs.existsSync(path)) {
        tl.error(tl.loc('FileNotFoundException', path));
        throw new Error(tl.loc('FileNotFoundException', path));
    }
}