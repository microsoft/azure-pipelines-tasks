"use strict";

import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import fs = require('fs');
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as utils from './utils';
import * as os from "os";
import * as util from "util";
import * as semver from 'semver';
import minimatch = require('minimatch');
const uuidV4 = require('uuid/v4');
const helmToolName = "helm";
const helmAllReleasesUrl = "https://api.github.com/repos/helm/helm/releases";
const stableHelmVersion = "v3.1.2"

export async function getHelmVersion(): Promise<string> {
    var checkLatestHelmVersion = tl.getBoolInput('checkLatestHelmVersion', false);
    if (checkLatestHelmVersion) {
        return await getStableHelmVersion();
    }

    return utils.sanitizeVersionString(tl.getInput("helmVersion", true));
}

export async function downloadHelm(version: string): Promise<string> {
    var cachedToolpath = toolLib.findLocalTool(helmToolName, version);
    if (!cachedToolpath) {
        try {
            var helmDownloadPath = await toolLib.downloadTool(getHelmDownloadURL(version), helmToolName + "-" + version + "-" + uuidV4() + ".zip");
        } catch (exception) {
            throw new Error(tl.loc("HelmDownloadFailed", getHelmDownloadURL(version), exception));
        }

        var unzipedHelmPath = await toolLib.extractZip(helmDownloadPath);
        cachedToolpath = await toolLib.cacheDir(unzipedHelmPath, helmToolName, version);
    }

    var helmpath = findHelm(cachedToolpath);
    if (!helmpath) {
        throw new Error(tl.loc("HelmNotFoundInFolder", cachedToolpath))
    }

    // For owner needs to keep the executable permission
    fs.chmodSync(helmpath, "744");
    return helmpath;
}

function findHelm(rootFolder: string) {
    var helmPath = path.join(rootFolder, "*", helmToolName + getExecutableExtention());
    var allPaths = tl.find(rootFolder);
    var matchingResultsFiles = minimatch.match(allPaths, helmPath, rootFolder);
    return matchingResultsFiles[0];
}


function getHelmDownloadURL(version: string): string {
    switch (os.type()) {
        case 'Linux':
            return util.format("https://get.helm.sh/helm-%s-linux-amd64.zip", version);

        case 'Darwin':
            return util.format("https://get.helm.sh/helm-%s-darwin-amd64.zip", version);

        default:
        case 'Windows_NT':
            return util.format("https://get.helm.sh/helm-%s-windows-amd64.zip", version);

    }
}

async function getStableHelmVersion(): Promise<string> {
    try {
        let allReleases: any[] = [];
        let page = 1;
        const perPage = 100; // GitHub API max per page
        let hasMorePages = true;

        // Fetch all pages of releases
        while (hasMorePages) {
            const pagedUrl = `${helmAllReleasesUrl}?page=${page}&per_page=${perPage}`;
            const downloadPath = await toolLib.downloadTool(pagedUrl);
            const pageResponseArray = JSON.parse(fs.readFileSync(downloadPath, 'utf8').toString().trim());
            
            if (pageResponseArray.length === 0) {
                // No more releases on this page
                hasMorePages = false;
            } else {
                allReleases = allReleases.concat(pageResponseArray);
                page++;
                
                // If we got less than the requested per_page amount, we've reached the last page
                if (pageResponseArray.length < perPage) {
                    hasMorePages = false;
                }
            }
        }

        let latestHelmVersion = semver.clean(stableHelmVersion);
        allReleases.forEach(response => {
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

        tl.warning(tl.loc("HelmLatestNotKnown", helmAllReleasesUrl, error, stableHelmVersion));
    }

    return stableHelmVersion;
}

function getExecutableExtention(): string {
    if (os.type().match(/^Win/)) {
        return ".exe";
    }

    return "";
} 
