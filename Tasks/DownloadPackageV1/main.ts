var path = require("path");

import * as vsts from "vso-node-api/WebApi";
import * as locationUtility from "packaging-common/locationUtilities";
import * as tl from "vsts-task-lib/task";
import * as nutil from "packaging-common/nuget/Utility";

import { PackageUrlsBuilder } from "./packagebuilder";
import { Extractor } from "./extractor";

tl.setResourcePath(path.join(__dirname, "task.json"));

async function main(): Promise<void> {
    // TODO Get that logic to check for GUID from v0 after verifying why its needed.
    // TODO fix getvar to get input
    console.log("Starting download ");
    // Getting variables.
    let packageType = tl.getVariable("packageType");
    let feedId = tl.getInput("feed");
    let viewId = tl.getVariable("view");
    let packageId = tl.getVariable("definition");
    let version = tl.getVariable("version");
    let downloadPath = tl.getInput("downloadPath");
    let collectionUrl = tl.getVariable("System.TeamFoundationCollectionUri");
    let filesPattern = tl.getVariable("files");
    let files: string[] = nutil.getPatternsArrayFromInput(filesPattern);
    let extractPackage = tl.getVariable("extract").toUpperCase() === "TRUE"; 

    const retryLimitValue: string = tl.getVariable("VSTS_HTTP_RETRY");
    const retryLimit: number = !!retryLimitValue && !isNaN(parseInt(retryLimitValue)) ? parseInt(retryLimitValue) : 4;

    var feedConnection = await getConnection("7AB4E64E-C4D8-4F50-AE73-5EF2E21642A5", collectionUrl);
    var pkgsConnection = await getConnection("B3BE7473-68EA-4A81-BFC7-9530BAAA19AD", collectionUrl);

    var p = await new PackageUrlsBuilder()
        .ofType(packageType)
        .withPkgsConnection(pkgsConnection)
        .withFeedsConnection(feedConnection)
        .matchingPattern(files)
        .withMaxRetries(retryLimit)
        .build();

    var extractors: Extractor[] = await p.download(feedId, packageId, version, downloadPath);
  

    // TODO fix this logic to make it promisy.
    if (extractPackage) {
        extractors.forEach(async extractor => {
            await extractor.extractFile();
        });
    }
}

function getAccessToken() {
    var auth = tl.getEndpointAuthorization("SYSTEMVSSCONNECTION", false);
    if (auth.scheme.toLowerCase() === "oauth") {
        return auth.parameters["AccessToken"];
    } else {
        throw new Error(tl.loc("CredentialsNotFound"));
    }
}

function getConnection(areaId: string, collectionUrl: string): Promise<vsts.WebApi> {
    var accessToken = getAccessToken();
    var credentialHandler = vsts.getBearerHandler(accessToken);
    return locationUtility
        .getServiceUriFromAreaId(collectionUrl, accessToken, areaId)
        .then(url => {
            return new vsts.WebApi(url, credentialHandler);
        })
        .catch(error => {
            throw error;
        });
}

main()
    .then(result => tl.setResult(tl.TaskResult.Succeeded, ""))
    .catch(error => tl.setResult(tl.TaskResult.Failed, error));
