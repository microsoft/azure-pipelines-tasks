"use strict";

import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import fs = require('fs');
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as os from 'os';
import * as util from 'util';
import { WebRequest, sendRequest } from 'azure-pipelines-tasks-utility-common/restutilities';
import { download } from 'azure-pipelines-tasks-utility-common/downloadutility';

const DuffleToolName = 'duffle';
const DuffleLatestReleaseUrl = 'https://api.github.com/repos/deislabs/Duffle/releases/latest';
const StableDuffleVersion = '0.1.0-ralpha.4+dramallamabuie';

export async function setupDuffle(): Promise<string> {
    let version = tl.getInput('version', false) || StableDuffleVersion;
    const checkLatestDuffleVersion = tl.getBoolInput('checkLatestVersion', false);
    if (checkLatestDuffleVersion) {
        version = await getStableDuffleVersion();
    }

    return await downloadDuffle(version);
}

async function downloadDuffle(version: string): Promise<string> {
    let cachedToolPath = toolLib.findLocalTool(DuffleToolName, version);
    if (!cachedToolPath) {
        let duffleDownloadPath = '';
        try {
            duffleDownloadPath = getDuffleInstallPath();
            const downloadUrl = getDuffleDownloadURL(version);
            await download(downloadUrl, duffleDownloadPath, false, true);
        } catch (exception) {
            throw new Error(tl.loc('DownloadDuffleFailed', getDuffleDownloadURL(version), exception));
        }

        cachedToolPath = await toolLib.cacheFile(duffleDownloadPath, DuffleToolName + getExecutableExtension(), DuffleToolName, version);
    }

    const dufflePath = path.join(cachedToolPath, DuffleToolName + getExecutableExtension());
    fs.chmodSync(dufflePath, '777');
    return dufflePath;
}

function getDuffleDownloadURL(version: string): string {
    switch (os.type()) {
        case 'Linux':
            return util.format('https://github.com/deislabs/duffle/releases/download/%s/duffle-linux-amd64', version);

        case 'Darwin':
            return util.format('https://github.com/deislabs/duffle/releases/download/%s/duffle-darwin-amd64', version);

        default:
        case 'Windows_NT':
            return util.format('https://github.com/deislabs/duffle/releases/download/%s/duffle-windows-amd64.exe', version);

    }
}

async function getStableDuffleVersion(): Promise<string> {
    const request = new WebRequest();
    request.uri = DuffleLatestReleaseUrl;
    request.method = 'GET';

    try {
        const response = await sendRequest(request);
        return response.body["tag_name"];
    } catch (error) {
        tl.warning(tl.loc('DownloadStableVersionFailed', DuffleLatestReleaseUrl, error, StableDuffleVersion));
    }

    return StableDuffleVersion;
}

function getDuffleInstallPath(): string {
    const configDir = path.join(getTempDirectory(), 'Duffle' + Date.now());
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir);
    }

    return path.join(configDir, DuffleToolName + getExecutableExtension());
}

function getTempDirectory(): string {
    return tl.getVariable('agent.tempDirectory') || os.tmpdir();
}

function getExecutableExtension(): string {
    if (os.type().match(/^Win/)) {
        return '.exe';
    }

     return '';
}