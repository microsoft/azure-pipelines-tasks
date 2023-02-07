"use strict";

var https   = require('https');
var fs      = require('fs');
import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";
import * as os from "os";
import * as util from "util";
import * as toolLib from 'azure-pipelines-tool-lib/tool';

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
    
    if(checkLatest) {
        return await kubectlutility.getStableKubectlVersion();
    }
    else if (versionSpec) {
        if(versionSpec === "1.7") {
            // Backward compat handle
            tl.warning(tl.loc("UsingLatestStableVersion"));
            return kubectlutility.getStableKubectlVersion();
        } 
        else if ("v".concat(versionSpec) === kubectlutility.stableKubectlVersion) {
            tl.debug(util.format("Using default versionSpec:%s.", versionSpec));
            return kubectlutility.stableKubectlVersion;
        }
        else {
            // Do not check for validity of the version here,
            // We'll return proper error message when the download fails
            if(!versionSpec.startsWith("v")) {
                return "v".concat(versionSpec);
            }
            else{
                return versionSpec;
            }
        } 
     }
 
     return kubectlutility.stableKubectlVersion;
 }

export async function downloadKubectl(version: string): Promise<string> {
    return await kubectlutility.downloadKubectl(version);
}

export function sanitizeVersionString(versions, inputVersion: string): string {
    var version = toolLib.evaluateVersions(versions, inputVersion);
    if (!version) {
        throw new Error(tl.loc("NotAValidVersion", JSON.stringify(versions)));
    }

    return version;
}

export function assertFileExists(path: string) {
    if(!fs.existsSync(path)) {
        tl.error(tl.loc('FileNotFoundException', path));
        throw new Error(tl.loc('FileNotFoundException', path));
    }
}

export function writeInlineConfigInTempPath(inlineConfig: string): string {
    var tempInlinePath = getNewUserDirPath();
    tempInlinePath = path.join(tempInlinePath, "inlineconfig.yaml");
    fs.writeFileSync(tempInlinePath, inlineConfig);
    return tempInlinePath;
}