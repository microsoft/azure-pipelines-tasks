import * as locationUtility from "packaging-common/locationUtilities";
import * as tl from "vsts-task-lib/task";
import * as nutil from "packaging-common/nuget/Utility";
import { WebApi } from "azure-devops-node-api";
import { PackageUrlsBuilder } from "./packagebuilder";

async function main(): Promise<void> {
    // Getting inputs.
    let packageType = tl.getInput("packageType");
    let feedId = tl.getInput("feed");
    let viewId = tl.getInput("view");
    let packageId = tl.getInput("definition");
    let version = tl.getInput("version");
    let downloadPath = tl.getInput("downloadPath");
    let filesPattern = tl.getInput("files");
    let extractPackage = tl.getInput("extract") === "true";

    // Getting variables.
    const collectionUrl = tl.getVariable("System.TeamFoundationCollectionUri");
    const retryLimitValue: string = tl.getVariable("VSTS_HTTP_RETRY");
    const retryLimit: number = !!retryLimitValue && !isNaN(parseInt(retryLimitValue)) ? parseInt(retryLimitValue) : 4;
    const deleteArchive = tl.getVariable("deleteArchive") === "true";
    const skipDownload = tl.getVariable("skipDownload") === "true";
    var accessToken = locationUtility.getSystemAccessToken();


    if(viewId) {
        feedId = feedId + "@" + viewId;
    }

    let files: string[] = [];
    if(filesPattern) {
        files = nutil.getPatternsArrayFromInput(filesPattern);
    }
    
    var feedConnection = await getConnection("7AB4E64E-C4D8-4F50-AE73-5EF2E21642A5", collectionUrl);
    var pkgsConnection = await getConnection("B3BE7473-68EA-4A81-BFC7-9530BAAA19AD", collectionUrl);

    var p = await new PackageUrlsBuilder()
        .ofType(packageType)
        .withPkgsConnection(pkgsConnection)
        .withFeedsConnection(feedConnection)
        .matchingPattern(files)
        .withMaxRetries(retryLimit)
        .build();
    tl.debug("Hello");    

    await p.download(feedId, packageId, version, downloadPath);
    tl.debug("Hello");    

    return Promise.resolve();
}

async function getConnection(areaId: string, collectionUrl: string): Promise<WebApi> {
    var accessToken = locationUtility.getSystemAccessToken();
    return locationUtility
        .getServiceUriFromAreaId(collectionUrl, accessToken, areaId)
        .then(url => {
            return locationUtility.getWebApiWithProxy(url);
            //return vsts.WebApi.createWithBearerToken(url, accessToken);
        })
        .catch(error => {
            throw error;
        });
}
main()
    .then(result => tl.setResult(tl.TaskResult.Succeeded, ""))
    .catch(error => tl.setResult(tl.TaskResult.Failed, error));
