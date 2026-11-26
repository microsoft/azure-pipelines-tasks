"use strict";

var https   = require('https');
var fs      = require('fs');
import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";
import * as os from "os";
import * as util from "util";
import * as toolLib from 'azure-pipelines-tool-lib/tool';

import kubectlutility = require("azure-pipelines-tasks-kubernetes-common/kubectlutility");
import downloadutility = require("azure-pipelines-tasks-utility-common/downloadutility");

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

// The kubectl version is embedded in the download URL, which azure-pipelines-tool-lib writes to the task log.
// Only a semantic version is accepted so the value can never carry URL delimiters or logging-command markers.
export function validateKubectlVersion(version: string, invalidMessageKey: "InvalidKubectlVersion" | "InvalidStableKubectlVersion" = "InvalidKubectlVersion"): string {
    const cleanVersion = version ? toolLib.cleanVersion(version) : null;
    if (!cleanVersion) {
        throw new Error(tl.loc(invalidMessageKey));
    }

    return "v".concat(cleanVersion);
}

// Name under which azure-pipelines-tasks-kubernetes-common caches kubectl in the agent's tool cache.
const kubectlToolName = "kubectl";

// A version specification consists of the characters of a semver range and is short. Anything else cannot match a cached
// version, so it is rejected before it reaches the range parser, which is slow for long input.
const maxVersionSpecificationLength = 256;
const versionSpecificationCharacters = /^[0-9A-Za-z.+\-*<>=~^|\s]+$/;

// Resolves a version specification to a concrete, v-prefixed kubectl version.
// A semantic version (1.31.0, v1.31.0, 1.31.0-rc.1) is normalized; it is the only kind of value a download URL is built from.
// Any other specification (for example 1.x.0 or 1.31.x) can only be resolved against the kubectl versions that are already in
// the agent's tool cache, as the common downloader has always done, and is never used to build a download URL.
export function resolveKubectlVersion(versionSpec: string): string {
    if (versionSpec && toolLib.cleanVersion(versionSpec)) {
        return validateKubectlVersion(versionSpec);
    }

    if (!versionSpec || versionSpec.length > maxVersionSpecificationLength || !versionSpecificationCharacters.test(versionSpec)) {
        throw new Error(tl.loc("InvalidKubectlVersion"));
    }

    // Specifications have always been matched with a v prefix.
    const specification = versionSpec.startsWith("v") ? versionSpec : "v".concat(versionSpec);
    const cachedVersion = toolLib.evaluateVersions(toolLib.findLocalToolVersions(kubectlToolName), specification);
    if (!cachedVersion) {
        throw new Error(tl.loc("InvalidKubectlVersion"));
    }

    return validateKubectlVersion(cachedVersion);
}

export async function getKubectlVersion(versionSpec: string, checkLatest: boolean) : Promise<string> {
    
    if(checkLatest) {
        return validateKubectlVersion(await kubectlutility.getStableKubectlVersion(), "InvalidStableKubectlVersion");
    }
    else if (versionSpec) {
        if(versionSpec === "1.7") {
            // Backward compat handle
            tl.warning(tl.loc("UsingLatestStableVersion"));
            return validateKubectlVersion(await kubectlutility.getStableKubectlVersion(), "InvalidStableKubectlVersion");
        } 
        else if ("v".concat(versionSpec) === kubectlutility.stableKubectlVersion) {
            tl.debug(util.format("Using default versionSpec:%s.", versionSpec));
            return kubectlutility.stableKubectlVersion;
        }
        else {
            return resolveKubectlVersion(versionSpec);
        } 
     }
 
     return kubectlutility.stableKubectlVersion;
 }

export async function downloadKubectl(version: string): Promise<string> {
    return await kubectlutility.downloadKubectl(resolveKubectlVersion(version));
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