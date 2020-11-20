import * as path from 'path';
import * as fs from 'fs';
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as os from 'os';
import * as util from 'util';
import * as uuidV4 from 'uuid/v4';
import * as tl from 'azure-pipelines-task-lib/task';
import { getExecutableExtension } from './utility';
import * as  osutil from './osutility';
const semver = require('semver');

tl.setResourcePath(path.join(__dirname, 'module.json'), true);

const helmToolName = 'helm';
const helmAllReleasesUrl = 'https://api.github.com/repos/helm/helm/releases';
const stableHelmVersion = 'v3.1.2';

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
            const architecture = osutil.getSupportedLinuxArchitecture();
            return util.format('https://get.helm.sh/helm-%s-linux-%s.zip', version, architecture);

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
        const downloadPath = await toolLib.downloadTool(helmAllReleasesUrl);
        const responseArray = JSON.parse(fs.readFileSync(downloadPath, 'utf8').toString().trim());
        let latestHelmVersion = semver.clean(stableHelmVersion);
        responseArray.forEach(response => {
            if (response && response.tag_name) {
                let currentHelmVerison = semver.clean(response.tag_name.toString());
                if (currentHelmVerison) {
                    if (currentHelmVerison.toString().indexOf('rc') == -1 && semver.gt(currentHelmVerison, latestHelmVersion)) {
                        //If current helm version is not a pre release and is greater than latest helm version
                        latestHelmVersion = currentHelmVerison;
                    }
                }
            }
        });
        latestHelmVersion = "v" + latestHelmVersion;
        return latestHelmVersion;
    } catch (error) {
        let telemetry = {
            event: "HelmLatestNotKnown",
            url: helmAllReleasesUrl,
            error: error
        };
        console.log("##vso[telemetry.publish area=%s;feature=%s]%s",
            "TaskEndpointId",
            "HelmInstaller",
            JSON.stringify(telemetry));

        tl.warning(tl.loc('HelmLatestNotKnown', helmAllReleasesUrl, error, stableHelmVersion));
    }

    return stableHelmVersion;
}
