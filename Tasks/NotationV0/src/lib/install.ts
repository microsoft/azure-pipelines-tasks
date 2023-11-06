import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as taskLib from 'azure-pipelines-task-lib/task';
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import { computeChecksum } from './crypto';

export async function installFromURL(downloadURL: string, expectedChecksum: string, extractPath: string): Promise<void> {
    // Download notation
    const fileName = path.basename(downloadURL);
    console.log('start');
    const downloadPath = await toolLib.downloadTool(downloadURL, fileName);
    console.log('end');

    // Validate checksum
    const checksum = await computeChecksum(downloadPath);
    if (expectedChecksum !== checksum) {
        throw new Error(taskLib.loc('ChecksumValidationFailed', expectedChecksum, checksum));
    }
    console.log(taskLib.loc('ChecksumValidated', expectedChecksum));

    taskLib.mkdirP(extractPath);

    // Extract notation binary
    await extractBinary(downloadPath, extractPath);
}

async function extractBinary(filePath: string, extractPath: string): Promise<string> {
    if (filePath.endsWith('.zip')) {
        return toolLib.extractZip(filePath, extractPath);
    } else if (filePath.endsWith('.tar.gz')) {
        return toolLib.extractTar(filePath, extractPath);
    }
    throw new Error(taskLib.loc('UnsupportedFileExtension', path.extname(filePath)));
}

// Get the download URL and checksum for the notation binary 
// based on the version
export function getDownloadInfo(versionPrefix: string, versionFileName: string): { version: string, url: string, checksum: string } {
    const versionFile = path.join(__dirname, '..', '..', 'data', versionFileName);
    const versionData = fs.readFileSync(versionFile, 'utf8');
    const versionList = JSON.parse(versionData);

    for (const versionSuite of versionList) {
        if (isMatch(versionSuite["version"], versionPrefix)) {
            return fetchTarget(versionSuite);
        }
    }

    throw new Error(taskLib.loc('UnsupportedVersion', versionPrefix));
}

function isMatch(version: string, versionPrefix: string): boolean {
    // if the version range is for pre-release version, it needs to match 
    // the full version
    if (versionPrefix.includes('-')) {
        return versionPrefix === version;
    }

    // for released version, it only needs to match the prefix
    const versionParts = version.split('.'); // major.minor.patch
    const versionPrefixParts = versionPrefix.split('.');
    if (versionPrefixParts.length > versionParts.length) {
        throw new Error(taskLib.loc('InvalidVersionPrefix', versionPrefix));
    }

    for (let i = 0; i < versionPrefixParts.length; i++) {
        if (versionPrefixParts[i] !== versionParts[i]) {
            return false;
        }
    }
    return true;
}

function fetchTarget(versionSuite: any): { version: string, url: string, checksum: string } {
    const platform = getPlatform();
    const arch = getArch();
    if (!(platform in versionSuite)) {
        throw new Error(taskLib.loc('UnsupportedPlatform', platform));
    }

    if (!(arch in versionSuite[platform])) {
        throw new Error(taskLib.loc('UnsupportedArchitecture', arch));
    }

    return {
        version: versionSuite["version"],
        url: versionSuite[platform][arch]["url"],
        checksum: versionSuite[platform][arch]["checksum"]
    };
}

function getPlatform(): string {
    const platform = os.platform();
    switch (platform) {
        case 'linux':
            return 'linux';
        case 'darwin':
            return 'darwin';
        case 'win32':
            return 'windows';
        default:
            throw new Error(taskLib.loc('UnsupportedPlatform', platform));
    }
}

function getArch(): string {
    const architecture = os.arch();
    switch (architecture) {
        case 'x64':
            return 'amd64';
        case 'arm64':
            return 'arm64';
        default:
            throw new Error(taskLib.loc('UnsupportedArchitecture', architecture));
    }
}
