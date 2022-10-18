"use strict";

var https   = require('https');
var fs      = require('fs');
import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";
import * as os from "os";
import * as util from "util";

import downloadutility = require("utility-common-v2/downloadutility");

export function getTempDirectory(): string {
    return tl.getVariable('agent.tempDirectory') || os.tmpdir();
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

export async function getKubectlVersion(versionSpec: string, checkLatest: boolean) : Promise<string> {
   let version: string = "v1.6.6";   

   if(checkLatest) {
        return getStableKubectlVersion();
   }
   else if (versionSpec) {
       if(versionSpec === "1.7") {
           // Backward compat handle
           tl.warning(tl.loc("UsingLatestStableVersion"));
           return getStableKubectlVersion();
       } 
       else if(!versionSpec.startsWith("v")) {
           version = "v".concat(versionSpec);
       }
       else {
            version = versionSpec;
       } 
    }

	return version;
}

export async function getStableKubectlVersion() : Promise<string> {
    var stableVersion = "v1.6.6";
    var version;
    var stableVersionUrl = "https://storage.googleapis.com/kubernetes-release/release/stable.txt";
    var downloadPath = path.join(getTempDirectory(), getCurrentTime().toString()+".txt");
    return downloadutility.download(stableVersionUrl, downloadPath, false, true).then((resolve) => {
        version = fs.readFileSync(downloadPath, "utf8").toString().trim();
        if(!version){
            version = stableVersion;
        }
        return version;
    },
    (reject) => {
        tl.debug(reject);
        tl.warning(tl.loc('DownloadStableVersionFailed', stableVersionUrl, stableVersion));
        return stableVersion;
    })
}

export async function downloadKubectl(version: string, kubectlPath: string): Promise<string> {
    var kubectlURL = getkubectlDownloadURL(version);
    tl.debug(tl.loc('DownloadingKubeCtlFromUrl', kubectlURL));
    var kubectlPathTmp = kubectlPath+".tmp";
    return downloadutility.download(kubectlURL, kubectlPathTmp, false, true).then( (res) => {
            tl.cp(kubectlPathTmp, kubectlPath, "-f");
            fs.chmodSync(kubectlPath, "777");
            assertFileExists(kubectlPath);
            return kubectlPath;
    },
    (reason) => {
        //Download kubectl client failed.
        throw new Error(tl.loc('DownloadKubeCtlFailed', version));
    }); 
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

export function assertFileExists(path: string) {
    if(!fs.existsSync(path)) {
        tl.error(tl.loc('FileNotFoundException', path));
        throw new Error(tl.loc('FileNotFoundException', path));
    }
}