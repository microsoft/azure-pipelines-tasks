// Placed as a separate file for the purpose of unit testing
import * as locatorHelper from "nuget-task-common/LocationHelpers"
import os = require("os");
import * as path from "path";
import * as semver from 'semver';
import * as vsts from "vso-node-api"
import * as tl from "vsts-task-lib";
import * as toollib from "vsts-task-tool-lib/tool"
import AdmZip = require('adm-zip');

export function getArtifactToolLocation(dirName: string): string {
    let toolPath: string = path.join(dirName, "ArtifactTool.exe");
    if (tl.osType() !== "Windows_NT"){
        toolPath = path.join(dirName, "artifacttool");
    }
    return toolPath;
}

function _createExtractFolder(dest?: string): string {
    if (!dest) {
        // create a temp dir
        dest = path.join(tl.getVariable("Agent.TempDirectory"), "artifactTool");
    }
    tl.mkdirP(dest);
    return dest;
}

export async function extractZip(file: string): Promise<string> {
    if (!file) {
        throw new Error("parameter 'file' is required");
    }
    let dest = _createExtractFolder();
    let zip = new AdmZip(file);
    zip.extractAllTo(dest, true);
    return dest;
}

export async function getArtifactToolFromService(serviceUri: string, accessToken: string, toolName: string){

    let osName = tl.osType();
    let arch = os.arch();
    if(osName === "Windows_NT"){
        osName = "windows";
    }
    if (arch === "x64"){
        arch = "amd64";
    }
    const blobstoreAreaName = "clienttools";
    const blobstoreAreaId = "187ec90d-dd1e-4ec6-8c57-937d979261e5";
    const ApiVersion = "5.0-preview";

    const credentialHandler = vsts.getBasicHandler("fakeUsername", accessToken);
    const blobstoreConnection = new vsts.WebApi(serviceUri, credentialHandler);

    let blobstoreApi = blobstoreConnection.getCoreApi();

    // Get packaging versions url
    const artifactToolGetUrl = await new Promise<string>((resolve, reject) => {
        let getToolDataPromise = blobstoreApi.vsoClient.getVersioningData(ApiVersion,
            blobstoreAreaName, blobstoreAreaId, { toolName }, {osName, arch});
        getToolDataPromise.then((result) => {
            return resolve(result.requestUrl);
        });
        getToolDataPromise.catch((error) => {
            return reject(error);
        });
    });

    // Get highest version
    const artifactToolUri =  await new Promise<any>((resolve, reject) => {
        blobstoreApi.restClient.get(artifactToolGetUrl, ApiVersion, null, { responseIsCollection: false },
            async function (error, status, toolResult) {
                if (!!error || status !== 200) {
                    return reject(error.message);
                }
                // Getting the tool uri
                return resolve(toolResult);
            });
    });

    let artifactToolPath = toollib.findLocalTool(toolName, artifactToolUri.version);
    if (!artifactToolPath) {
        tl.debug(tl.loc("Info_DownloadingArtifactTool", artifactToolUri.uri));

        const zippedToolsDir: string = await toollib.downloadTool(artifactToolUri.uri);

        const unzippedToolsDir = await extractZip(zippedToolsDir);

        artifactToolPath = await toollib.cacheDir(unzippedToolsDir, "ArtifactTool", artifactToolUri.version);
    }
    else{
        tl.debug(tl.loc("Info_ResolvedToolFromCache", artifactToolPath));
    }
    return getArtifactToolLocation(artifactToolPath);
}

// set the console code page to "UTF-8"
export function setConsoleCodePage() {
    if (tl.osType() === "Windows_NT") {
        tl.execSync(path.resolve(process.env.windir, "system32", "chcp.com"), ["65001"]);
    }
}

export function getVersionUtility(versionRadio: string, highestVersion: string): string {
    switch(versionRadio) {
        case "patch":
            return semver.inc(highestVersion, "patch");
        case "minor":
            return semver.inc(highestVersion, "minor");
        case "major":
            return semver.inc(highestVersion, "major");
        default:
            return null;
    }
}

async function getServiceUriFromCollectionUri(serviceUri: string, accessToken: string, areaName: string, areaId: string): Promise<string>{
    let connectionData = await locatorHelper.getConnectionDataForArea(serviceUri, areaName, areaId, "vsts", accessToken);

    return connectionData.locationServiceData.accessMappings.find(
        (mapping) => mapping.moniker === connectionData.locationServiceData.defaultAccessMappingMoniker)
        .accessPoint;
}

// Feeds url from location service
export async function getFeedUriFromBaseServiceUri(serviceUri: string, accesstoken: string): Promise<string>{
    const feedAreaName = "Packaging";
    const feedAreaId = "7ab4e64e-c4d8-4f50-ae73-5ef2e21642a5";

    return getServiceUriFromCollectionUri(serviceUri, accesstoken, feedAreaName, feedAreaId);
}

export async function getBlobstoreUriFromBaseServiceUri(serviceUri: string, accesstoken: string): Promise<string>{
    const blobAreaName = "blob";
    const blobAreaId = "5294ef93-12a1-4d13-8671-9d9d014072c8";
    return getServiceUriFromCollectionUri(serviceUri, accesstoken, blobAreaName, blobAreaId);
}

export async function getPackageNameFromId(serviceUri: string, accessToken: string, feedId: string, packageId: string): Promise<string> {
    const ApiVersion = "3.0-preview.1";
    const PackagingAreaName = "Packaging";
    const PackageAreaId = "7a20d846-c929-4acc-9ea2-0d5a7df1b197";

    const credentialHandler = vsts.getBasicHandler("vsts", accessToken);
    const feedConnection = new vsts.WebApi(serviceUri, credentialHandler);

    let feedApi = feedConnection.getCoreApi();

    // Getting url for feeds version API
    const packageUrl = await new Promise<string>((resolve, reject) => {
        let getVersioningDataPromise = feedApi.vsoClient.getVersioningData(ApiVersion, PackagingAreaName, PackageAreaId, { feedId, packageId });
        getVersioningDataPromise.then((result) => {
            return resolve(result.requestUrl);
        });
        getVersioningDataPromise.catch((error) => {
            return reject(error);
        });
    });

    // getting package name from the right url
    const packageName =  await new Promise<string>((resolve, reject) => {
        feedApi.restClient.get(packageUrl, ApiVersion, null, { responseIsCollection: false },
            async function (error, status, result) {
                if (!!error || status !== 200) {
                    // returning the user entered name if id not found
                    return resolve(packageId);
                }
                return resolve(result.name);
            });
    });

    return packageName;
}

export async function getHighestPackageVersionFromFeed(serviceUri: string, accessToken: string, feedId: string, packageName: string): Promise<string> {
    const ApiVersion = "3.0-preview.1";
    const PackagingAreaName = "Packaging";
    const PackageAreaId = "7a20d846-c929-4acc-9ea2-0d5a7df1b197";

    const credentialHandler = vsts.getBasicHandler("vsts", accessToken);
    const feedConnection = new vsts.WebApi(serviceUri, credentialHandler);

    let feedApi = feedConnection.getCoreApi();

    // Getting url for feeds version API
    const packageUrl = await new Promise<string>((resolve, reject) => {
        var getVersioningDataPromise = feedApi.vsoClient.getVersioningData(ApiVersion, PackagingAreaName, PackageAreaId, { feedId }, {packageNameQuery: packageName, protocolType: "upack", includeDeleted: "true", includeUrls: "false"});
        getVersioningDataPromise.then((result) => {
            return resolve(result.requestUrl);
        });
        getVersioningDataPromise.catch((error) => {
            return reject(error);
        });
    });

    // getting package name from the right url
    const highestPackageVersion =  await new Promise<string>((resolve, reject) => {
        feedApi.restClient.get(packageUrl, ApiVersion, null, { responseIsCollection: false },
            async function (error, status, result) {
                if (!!error || status !== 200) {
                    return reject(error);
                }
                if (result.count === 0) {
                    // If package Id not found then eat exception. This might be a new package name
                    return resolve("0.0.0");
                }
                result.value.forEach((element) => {
                    if (element.name === packageName.toLowerCase()){
                        return resolve(element.versions[0].version);
                    }
                });
                return resolve("0.0.0");
            });
    });
    return highestPackageVersion;
}
