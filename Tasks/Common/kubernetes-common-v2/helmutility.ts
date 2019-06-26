import * as path from 'path';
import * as fs from 'fs';
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as os from 'os';
import * as util from 'util';
import * as uuidV4 from 'uuid/v4';
import * as tl from 'azure-pipelines-task-lib/task';
import { getExecutableExtension } from './utility';

const helmToolName = 'helm';
const helmLatestReleaseUrl = 'https://api.github.com/repos/helm/helm/releases/latest';
const stableHelmVersion = 'v2.14.1';

export async function getHelm(version?: string) {
    try {
        return Promise.resolve(tl.which('helm', true));
    } catch (ex) {
        return downloadHelm(version);
    }
}

export async function downloadHelm(version?: string): Promise<string> {
    if (!version) { version = await getStableHelmVersion(); }
    let cachedToolpath = toolLib.findLocalTool(helmToolName, version);
    if (!cachedToolpath) {
        let helmDownloadPath;
        try {
            helmDownloadPath = await toolLib.downloadTool(getHelmDownloadURL(version), helmToolName + '-' + version + '-' + uuidV4() + '.zip');
        } catch (exception) {
            throw new Error(tl.loc('HelmDownloadFailed', getHelmDownloadURL(version), exception));
        }
        const unzipedHelmPath = await toolLib.extractZip(helmDownloadPath);
        cachedToolpath = await toolLib.cacheDir(unzipedHelmPath, helmToolName, version);
    }
    const helmpath = findHelm(cachedToolpath);
    if (!helmpath) {
        throw new Error(tl.loc('HelmNotFoundInFolder', cachedToolpath));
    }
    
    fs.chmodSync(helmpath, '777');
    return helmpath;
}

function findHelm(rootFolder: string) {
    const helmPath = path.join(rootFolder, '*', helmToolName + getExecutableExtension());
    const allPaths = tl.find(rootFolder);
    const matchingResultsFiles = tl.match(allPaths, helmPath, rootFolder);
    return matchingResultsFiles[0];
}

function getHelmDownloadURL(version: string): string {
    switch (os.type()) {
        case 'Linux':
            return util.format('https://get.helm.sh/helm-%s-linux-amd64.zip', version);

        case 'Darwin':
            return util.format('https://get.helm.sh/helm-%s-darwin-amd64.zip', version);

        case 'Windows_NT':
            return util.format('https://get.helm.sh/helm-%s-windows-amd64.zip', version);

        default:
            throw Error('Unknown OS type');
    }
}

export async function getStableHelmVersion(): Promise<string> {
    try {
        const downloadPath = await toolLib.downloadTool(helmLatestReleaseUrl);
        const response = JSON.parse(fs.readFileSync(downloadPath, 'utf8').toString().trim());
        if (!response.tag_name)
        {
            return stableHelmVersion;
        }
        
        return response.tag_name;
    } catch (error) {
        tl.warning(tl.loc('HelmLatestNotKnown', helmLatestReleaseUrl, error, stableHelmVersion));
    }

    return stableHelmVersion;
}
