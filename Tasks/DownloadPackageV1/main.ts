var path = require("path");

import * as tl from "azure-pipelines-task-lib/task";
import * as nutil from "azure-pipelines-tasks-packaging-common/nuget/Utility";
import * as telemetry from "azure-pipelines-tasks-utility-common/telemetry";

import { PackageUrlsBuilder } from "./packagebuilder";
import { PackageFile } from "./packagefile";
import { getConnection } from "./connections";
import { Retry } from "./retry";
import { downloadUniversalPackage } from "./universal";
import { getProjectAndFeedIdFromInputParam } from "azure-pipelines-tasks-packaging-common/util"

tl.setResourcePath(path.join(__dirname, "task.json"));

async function main(): Promise<void> {
    // Getting inputs.
    let packageType = tl.getInput("packageType");
    let projectFeed = tl.getInput("feed");
    let viewId = tl.getInput("view");
    let packageId = tl.getInput("definition");
    let version = tl.getInput("version");
    let downloadPath = tl.getInput("downloadPath");
    let filesPattern = tl.getInput("files");
    let extractPackage = tl.getInput("extract") === "true" && (packageType === "npm" || packageType === "nuget");

    // Getting variables.
    const collectionUrl = tl.getVariable("System.TeamFoundationCollectionUri");
    const retryLimitValue: string = tl.getVariable("VSTS_HTTP_RETRY");
    const retryLimit: number = !!retryLimitValue && !isNaN(parseInt(retryLimitValue)) ? parseInt(retryLimitValue) : 4;
    const skipDownload = tl.getVariable("Packaging.SkipDownload") === "true";

    try {
        if (skipDownload) {
            tl.debug("Download Package skipped.");
            return Promise.resolve();
        }

        var feed = getProjectAndFeedIdFromInputParam("feed");

        if (viewId && viewId.replace(/\s/g, "") !== "") {
            feed.feedId = feed.feedId + "@" + viewId;
        }

        if (packageType === "upack") {
            return await downloadUniversalPackage(downloadPath, feed.projectId, feed.feedId, packageId, version, filesPattern, Retry(retryLimit));
        }

        let files: string[] = [];
        if (filesPattern) {
            files = nutil.getPatternsArrayFromInput(filesPattern);
        }

        const feedConnection = await getConnection("7AB4E64E-C4D8-4F50-AE73-5EF2E21642A5", collectionUrl);
        const pkgsConnection = await getConnection("B3BE7473-68EA-4A81-BFC7-9530BAAA19AD", collectionUrl);

        var p = await new PackageUrlsBuilder()
            .ofType(packageType)
            .withPkgsConnection(pkgsConnection)
            .withFeedsConnection(feedConnection)
            .matchingPattern(files)
            .withRetries(Retry(retryLimit))
            .build();
        
        const regexGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        
        if(!regexGuid.test(packageId)){
            tl.debug("Trying to resolve package name " + packageId + " to id.");
            packageId = await p.resolvePackageId(feed.feedId, feed.projectId, packageId);
            tl.debug("Resolved package id: " + packageId);
        }

        if(version == "latest"){
            tl.debug("Trying to resolve latest version for " + packageId);
            version = await p.resolveLatestVersion(feed.feedId, feed.projectId, packageId);
            tl.debug("Resolved version to: " + version);
        }        

        const packageFiles: PackageFile[] = await p.download(feed.feedId, feed.projectId, packageId, version, downloadPath, extractPackage);

        await Promise.all(packageFiles.map((p) => p.process()));
        tl.setResult(tl.TaskResult.Succeeded, ""); 
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error);
    } finally {
        logTelemetry({
            PackageType: packageType,
            FeedId : feed.feedId,
            Project: feed.projectId,
            ViewId : viewId,
            PackageId: packageId,
            Version: version,
            SkipDownload: skipDownload,
            ExtractPackage: extractPackage,
            IsTriggeringArtifact: tl.getInput("isTriggeringArtifact")
        });
    }
}

function logTelemetry(params: any) {
    try {
        telemetry.emitTelemetry("Packaging", "DownloadPackagev1", params);
    } catch (err) {
        tl.debug(`Unable to log DownloadPackageV1 task telemetry. Err:( ${err} )`);
    }
}

main();