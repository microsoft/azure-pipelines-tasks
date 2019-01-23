var path = require("path");

import * as tl from "vsts-task-lib/task";
import { PackageUrlsBuilder } from "./packagebuilder";


tl.setResourcePath(path.join(__dirname, "task.json"));
async function main(): Promise<void> {
    // TODO Get that logic to check for GUID from v0 after verifying why its needed.
    // TODO fix getvar to get input
    let packageType = tl.getVariable("packageType");
    let feedId = tl.getInput("feed");
    let viewId = tl.getVariable("view");
    let packageId = tl.getVariable("definition");
    let version = tl.getVariable("version");
    console.log("version " + tl.getInput("version"));

    let downloadPath = tl.getInput("downloadPath");
    let collectionUrl = tl.getVariable("System.TeamFoundationCollectionUri");
    let files = tl.getVariable("files");
    let extractPackage = tl.getVariable("extract");
    const retryLimitValue: string = tl.getVariable("VSTS_HTTP_RETRY");
    const retryLimit: number = !!retryLimitValue && !isNaN(parseInt(retryLimitValue)) ? parseInt(retryLimitValue) : 4;


    var p = await new PackageUrlsBuilder()
		.ofType(packageType)
		.usingAccessToken(getAccessToken())
		.forCollection(collectionUrl)
		.matchingPattern(files)
        .withMaxRetries(retryLimit)
        .build();

    await p.download(feedId, packageId, version, downloadPath);
    await delay(20 * 1000);
}

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getAccessToken() {
    var auth = tl.getEndpointAuthorization("SYSTEMVSSCONNECTION", false);
    if (auth.scheme.toLowerCase() === "oauth") {
        return auth.parameters["AccessToken"];
    } else {
        throw new Error(tl.loc("CredentialsNotFound"));
    }
}

main()
    .then(result => tl.setResult(tl.TaskResult.Succeeded, ""))
    .catch(error => tl.setResult(tl.TaskResult.Failed, error));
