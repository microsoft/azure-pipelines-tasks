"use strict";

var https   = require('https');
var fs      = require('fs');
import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";
import * as os from "os";
import * as util from "util";

import kubectlutility = require("azure-pipelines-tasks-kubernetes-common-v2/kubectlutility");

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
    return await kubectlutility.getStableKubectlVersion();
}

export async function downloadKubectl(version: string, kubectlPath: string): Promise<string> {
    return await kubectlutility.downloadKubectl(version);
}

export function assertFileExists(path: string) {
    if(!fs.existsSync(path)) {
        tl.error(tl.loc('FileNotFoundException', path));
        throw new Error(tl.loc('FileNotFoundException', path));
    }
}