'use strict';

import fs = require('fs');
import * as taskLib from 'azure-pipelines-task-lib/task';
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';

const opaToolName = 'opa';
const opaLatestReleaseUrl = 'https://api.github.com/repos/open-policy-agent/opa/releases/latest';
const stableOpaVersion = 'v0.13.5';

export function getTempDirectory(): string {
    return taskLib.getVariable('agent.tempDirectory') || os.tmpdir();
}

export async function getOpaVersion(): Promise<string> {
    let opaVersion;
    opaVersion = taskLib.getInput('opaVersion', false);
    
    if (opaVersion && opaVersion != 'latest') {
        return sanitizeVersionString(opaVersion.trim());
    }
    
    return await getStableOpaVersion();
}

function getOpaDownloadURL(version: string): string {
    switch (os.type()) {
        case 'Linux':
            return util.format('https://github.com/open-policy-agent/opa/releases/download/%s/opa_linux_amd64', version);

        case 'Darwin':
            return util.format('https://github.com/open-policy-agent/opa/releases/download/%s/opa_darwin_amd64', version);

        case 'Windows_NT':
            return util.format('https://github.com/open-policy-agent/opa/releases/download/%s/opa_windows_amd64.exe', version);

        default:
            throw Error('Unknown OS type');
    }
}

export async function getStableOpaVersion(): Promise<string> {
    try {
        const downloadPath = await toolLib.downloadTool(opaLatestReleaseUrl);
        const response = JSON.parse(fs.readFileSync(downloadPath, 'utf8').toString().trim());
        if (!response.tag_name)
        {
            return stableOpaVersion;
        }
        
        return response.tag_name;
    } catch (error) {
        taskLib.warning(taskLib.loc('OpaLatestNotKnown', opaLatestReleaseUrl, error, stableOpaVersion));
    }
    return stableOpaVersion;
}

export function getExecutableExtension(): string {
    if (os.type().match(/^Win/)) {
        return '.exe';
    }

    return '';
}

export async function downloadOpa(version: string): Promise<string> {
    let cachedToolpath = toolLib.findLocalTool(opaToolName, version);
    let opaDownloadPath = '';
    if (!cachedToolpath) {
        try {
            opaDownloadPath = await toolLib.downloadTool(getOpaDownloadURL(version));
        } catch (exception) {
            throw new Error(taskLib.loc('DownloadOpaFailedFromLocation', getOpaDownloadURL(version), exception));
        }
        cachedToolpath = await toolLib.cacheFile(opaDownloadPath, opaToolName + getExecutableExtension(), opaToolName, version);
    }

    const opaPath = path.join(cachedToolpath, opaToolName + getExecutableExtension());

    if (!cachedToolpath || !fs.existsSync(opaPath)) {
        const opaPathTmp = path.join(getTempDirectory(), opaToolName + getExecutableExtension());
        taskLib.cp(opaDownloadPath, opaPathTmp, '-f');
        fs.chmodSync(opaPathTmp, '777');
        return opaPathTmp;
    }

    fs.chmodSync(opaPath, '777');
    return opaPath;
}

// handle user input scenerios
export function sanitizeVersionString(inputVersion: string) : string {
    const version = toolLib.cleanVersion(inputVersion);
    if (!version) {
        throw new Error(taskLib.loc('NotAValidSemverVersion'));
    }
    
    return 'v'+version;
}