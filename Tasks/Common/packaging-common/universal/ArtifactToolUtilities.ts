// Placed as a separate file for the purpose of unit testing
import AdmZip = require('adm-zip');
import os = require("os");
import * as path from "path";
import * as semver from "semver";
import * as pkgLocationUtils from "../locationUtilities";
import * as tl from "azure-pipelines-task-lib";
import * as toollib from "azure-pipelines-tool-lib/tool";

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

// there is a reason we do this instead of toollib.extractZip, but we don't recall what it is
// (might be Mac compatibility)
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

    const overrideArtifactToolPath = tl.getVariable("UPack.OverrideArtifactToolPath");
    if (overrideArtifactToolPath != null) {
        return getArtifactToolLocation(overrideArtifactToolPath);
    }

    let osName = tl.osType();
    let arch = os.arch();
    if (osName === "Windows_NT"){
        osName = "windows";
    }
    if (arch === "x64"){
        arch = "amd64";
    }

    // https://github.com/nodejs/node-v0.x-archive/issues/2862
    if (arch === "ia32") {
        if (process.env.PROCESSOR_ARCHITEW6432 != null && process.env.PROCESSOR_ARCHITEW6432.toUpperCase() === "AMD64") {
            arch = "amd64";
        }
    }

    if (arch.toLowerCase() !== "amd64") {
        throw new Error(tl.loc("Error_ProcessorArchitectureNotSupported"));
    }

    const blobstoreAreaName = "clienttools";
    const blobstoreAreaId = "187ec90d-dd1e-4ec6-8c57-937d979261e5";
    const ApiVersion = "5.0-preview";

    const blobstoreConnection = pkgLocationUtils.getWebApiWithProxy(serviceUri, accessToken);

    const artifactToolGetUrl = await pkgLocationUtils.Retry(async () => {
        return await blobstoreConnection.vsoClient.getVersioningData(ApiVersion,
        blobstoreAreaName, blobstoreAreaId, { toolName }, {osName, arch});
    }, 4, 100);

    const artifactToolUri =  await blobstoreConnection.rest.get(artifactToolGetUrl.requestUrl);

    if (artifactToolUri.statusCode !== 200) {
        tl.debug(tl.loc("Error_UnexpectedErrorFailedToGetToolMetadata", artifactToolUri.result.toString()));
        throw new Error(tl.loc("Error_UnexpectedErrorFailedToGetToolMetadata", artifactToolGetUrl.requestUrl));
    }

    let artifactToolPath = toollib.findLocalTool(toolName, artifactToolUri.result['version']);
    if (!artifactToolPath) {
        tl.debug(tl.loc("Info_DownloadingArtifactTool", artifactToolUri.result['uri']));

        const zippedToolsDir: string = await toollib.downloadTool(artifactToolUri.result['uri']);

        tl.debug("Downloaded zipped artifact tool to " + zippedToolsDir);
        const unzippedToolsDir = await extractZip(zippedToolsDir);

        artifactToolPath = await toollib.cacheDir(unzippedToolsDir, "ArtifactTool", artifactToolUri.result['version']);
    } else {
        tl.debug(tl.loc("Info_ResolvedToolFromCache", artifactToolPath));
    }
    return getArtifactToolLocation(artifactToolPath);
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

export async function getPackageNameFromId(serviceUri: string, accessToken: string, feedId: string, packageId: string): Promise<string> {
    const ApiVersion = "3.0-preview.1";
    const PackagingAreaName = "Packaging";
    const PackageAreaId = "7a20d846-c929-4acc-9ea2-0d5a7df1b197";

    const feedConnection = pkgLocationUtils.getWebApiWithProxy(serviceUri, accessToken);

    // Getting url for feeds version API
    const packageUrl = await new Promise<string>((resolve, reject) => {
        let getVersioningDataPromise = feedConnection.vsoClient.getVersioningData(ApiVersion, PackagingAreaName, PackageAreaId, { feedId, packageId });
        getVersioningDataPromise.then((result) => {
            return resolve(result.requestUrl);
        });
        getVersioningDataPromise.catch((error) => {
            return reject(error);
        });
    });

    // Return the user input incase of failure
    try{
        const response = await feedConnection.rest.get(packageUrl);
        if(response.statusCode === 200 && response.result['name']){
            return response.result['name'];
        }
        return packageId;
    }
    catch(err){
        return packageId;
    }
}

export async function getHighestPackageVersionFromFeed(serviceUri: string, accessToken: string, feedId: string, packageName: string): Promise<string> {
    const ApiVersion = "3.0-preview.1";
    const PackagingAreaName = "Packaging";
    const PackageAreaId = "7a20d846-c929-4acc-9ea2-0d5a7df1b197";

    const feedConnection = pkgLocationUtils.getWebApiWithProxy(serviceUri, accessToken);

    // Getting url for feeds version API
    const packageUrl = await new Promise<string>((resolve, reject) => {
        var getVersioningDataPromise = feedConnection.vsoClient.getVersioningData(ApiVersion, PackagingAreaName, PackageAreaId, { feedId }, {packageNameQuery: packageName, protocolType: "upack", includeDeleted: "true", includeUrls: "false"});
        getVersioningDataPromise.then((result) => {
            return resolve(result.requestUrl);
        });
        getVersioningDataPromise.catch((error) => {
            return reject(error);
        });
    });

    const versionResponse = await new Promise<string>((resolve, reject) => {
        let responsePromise = feedConnection.rest.get(packageUrl);
        responsePromise.then((result) => {
            if (result.result['count'] === 0){
                return resolve("0.0.0");
            }
            else{
                result.result['value'].forEach((element) => {
                    if (element.name === packageName.toLowerCase()){
                        return resolve(element.versions[0].version);
                    }
                });
            }
        });
        responsePromise.catch((error) => {
            return reject(error);
        });
    });

    return versionResponse;
}
