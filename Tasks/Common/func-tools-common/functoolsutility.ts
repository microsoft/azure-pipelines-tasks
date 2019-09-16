"use strict";

import * as fs from 'fs';
import * as os from 'os';
import * as util from 'util';
import * as tl from "azure-pipelines-task-lib/task";
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as path from "path";

function getExecutableExtension(): string {
    if (os.type().match(/^Win/)) {
        return '.exe';
    }

    return '';
}

function getDownloadUrl(version: string) {
    switch (os.type()) {
        case 'Linux':
            return util.format('https://github.com/Azure/azure-functions-core-tools/releases/download/%s/Azure.Functions.Cli.linux-x64.%s.zip', version, version);

        case 'Darwin':
            return util.format('https://github.com/Azure/azure-functions-core-tools/releases/download/%s/Azure.Functions.Cli.osx-x64.%s.zip', version, version);

        case 'Windows_NT':
        default:
            return util.format('https://github.com/Azure/azure-functions-core-tools/releases/download/%s/Azure.Functions.Cli.win-x86.%s.zip', version, version);

    }
}

export async function getLatestFuncToolsVersion(): Promise<string> {
    const funcToolsLatestReleaseUrl = 'https://api.github.com/repos/Azure/azure-functions-core-tools/releases/latest';
    const stableFuncToolsVersion = '2.7.1585';
    let latestVersion = stableFuncToolsVersion;

    try {
        const downloadPath = await toolLib.downloadTool(funcToolsLatestReleaseUrl);
        const response = JSON.parse(fs.readFileSync(downloadPath, 'utf8').toString().trim());
        if (response.tag_name)
        {
            latestVersion = response.tag_name;
        }
    } catch (error) {
        tl.warning(tl.loc('ErrorFetchingLatestVersion', funcToolsLatestReleaseUrl, error, stableFuncToolsVersion));
    }

    return latestVersion;
}

export async function downloadFuncTools(version: string): Promise<string> {
        tl.debug(util.format('Downloading the func tool version: %s..', version));
        const downloadUrl = getDownloadUrl(version);
        const downloadPath = await toolLib.downloadTool(downloadUrl);

        tl.debug('Extracting the downloaded zip..');
        const funcCliDirTmp = await toolLib.extractZip(downloadPath);
        const funcCliToolName = 'func' + getExecutableExtension();
        const funcCliPathTmp = path.join(funcCliDirTmp, funcCliToolName);
        
        fs.chmodSync(funcCliPathTmp, '777');
        return funcCliPathTmp;
}