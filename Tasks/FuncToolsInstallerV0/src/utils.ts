"use strict";

import * as fs from 'fs';
import * as tl from 'azure-pipelines-task-lib/task';
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as os from 'os';
import * as path from "path";
import * as util from 'util';

export async function getFuncToolsVersion(): Promise<string> {
    const version = tl.getInput("version");
    if (version && version !== "latest") {
        return sanitizeVersionString(version);
    }

    console.log(tl.loc("FindingLatestFuncToolsVersion"));
    const latestVersion =  await getLatestFuncToolsVersion();
    console.log(tl.loc("LatestFuncToolsVersion", latestVersion));
    return latestVersion;
}

export async function downloadFuncTools(version: string): Promise<string> {
    return await downloadFuncToolsInternal(version);
}

// handle user input scenerios
function sanitizeVersionString(inputVersion: string) : string{
    const version = toolLib.cleanVersion(inputVersion);
    if(!version) {
        throw new Error(tl.loc("NotAValidSemverVersion"));
    }
    
    return version;
}

const funcToolName = 'func';
const stableFuncToolsVersion = '4.6.0';

async function getLatestFuncToolsVersion(): Promise<string> {
    const funcToolsLatestReleaseUrl = 'https://api.github.com/repos/Azure/azure-functions-core-tools/releases/latest';
    let latestVersion = stableFuncToolsVersion;

    try {
        const downloadPath = await toolLib.downloadTool(funcToolsLatestReleaseUrl);
        const response = JSON.parse(fs.readFileSync(downloadPath, 'utf8').toString().trim());
        if (response.tag_name) {
            latestVersion = response.tag_name;
        }
    } catch (error) {
        tl.warning(tl.loc('ErrorFetchingLatestVersion', funcToolsLatestReleaseUrl, error, stableFuncToolsVersion));
    }

    return latestVersion;
}

async function downloadFuncToolsInternal(version: string): Promise<string> {
    let cachedToolpath = toolLib.findLocalTool(funcToolName, version);
    
    if (!cachedToolpath) {
        const downloadUrl = getDownloadUrl(version);
        let downloadPath;
        try {
            downloadPath = await toolLib.downloadTool(downloadUrl);
        }
        catch (ex) {
            throw new Error(tl.loc('FuncDownloadFailed', downloadUrl, ex));
        }
        
        tl.debug('Extracting the downloaded func tool zip..');
        const unzippedFuncPath = await toolLib.extractZip(downloadPath);
        cachedToolpath = await toolLib.cacheDir(unzippedFuncPath, funcToolName, version);
        console.log(tl.loc("SuccessfullyDownloaded", version, cachedToolpath));
    } else {
        console.log(tl.loc("VersionAlreadyInstalled", version, cachedToolpath));
    }

    const funcPath = path.join(cachedToolpath, funcToolName + getExecutableExtension());
    fs.chmodSync(funcPath, '755');
    const gozipPath = path.join(cachedToolpath, 'gozip' + getExecutableExtension());
    if (fs.existsSync(gozipPath)) {
        fs.chmodSync(gozipPath, '755');
    }
    
    return funcPath;
}

function getExecutableExtension(): string {
    if (os.type().match(/^Win/)) {
        return '.exe';
    }

    return '';
}

function getDownloadUrl(version: string) {
    let downloadUrlFormat = 'https://github.com/Azure/azure-functions-core-tools/releases/download/%s/Azure.Functions.Cli.%s.%s.zip';
    const platform = getPlatformIdentifier();
    return util.format(downloadUrlFormat, version, platform, version);
}

function getPlatformIdentifier(): string {
    const osType = os.type();
    const arch = os.arch();
    
    switch (osType) {
        case 'Linux':
            // Support for ARM64 added in 4.3.0
            return arch === 'arm64' ? 'linux-arm64' : 'linux-x64';

        case 'Darwin':
            // Apple Silicon (M1/M2/M3) support
            return arch === 'arm64' ? 'osx-arm64' : 'osx-x64';

        case 'Windows_NT':
            // Windows ARM64 support added in recent versions
            if (arch === 'arm64') {
                return 'win-arm64';
            }
            // Default to x64 for modern systems, fallback to x86 for 32-bit
            return arch === 'x64' ? 'win-x64' : 'win-x86';

        default:
            // Fallback to x64 for unknown platforms
            tl.warning(`Unknown platform: ${osType}. Defaulting to linux-x64.`);
            return 'linux-x64';
    }
}
