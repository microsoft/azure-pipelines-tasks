import tl = require("vsts-task-lib/task");
import path = require("path");
import glob = require('glob');
import fs = require('fs');

export function getGithubEndPointToken(): string {

    const githubEndpoint = tl.getInput('githubEndpoint');
    const githubEndpointObject = tl.getEndpointAuthorization(githubEndpoint, false);
    let githubEndpointToken: string = null;

    if (githubEndpointObject.scheme === 'PersonalAccessToken') {
        githubEndpointToken = githubEndpointObject.parameters.accessToken
    } else {
        // scheme: 'OAuth'
        githubEndpointToken = githubEndpointObject.parameters.AccessToken
    }

    return githubEndpointToken;
}

export function getUploadAssets(): string[] {

    let githubReleaseAssetInput = tl.getInput('githubReleaseAsset');
    let githubReleaseAssets = [];

    /** Check for one or multiples files into array
     *  Accept wildcards to look for files
     */
    if (githubReleaseAssetInput) {
        githubReleaseAssets = glob.sync(githubReleaseAssetInput);
    }

    tl.debug("Github release asset length = " + githubReleaseAssets.length);
    tl.debug("List of assets:");
    for (let asset of githubReleaseAssets) {
        tl.debug(asset);
    }

    return githubReleaseAssets;
}

export  function validateUploadAssets(): void {
    const assets: string[] = getUploadAssets();

    if (assets && assets.length > 0) {
        try {
            assets.forEach(function (asset) {
                tl.debug("Validating access of asset : " + asset);
                fs.accessSync(path.resolve(asset));
          })
        } catch (err) {
            throw new Error(tl.loc("MissingAssetError", err.path));
        }
    }
}