var path = require("path");

import * as tl from "vsts-task-lib/task";
import * as nutil from "packaging-common/nuget/Utility";
import * as telemetry from "utility-common/telemetry";

import { PackageUrlsBuilder } from "./packagebuilder";
import { Extractor } from "./extractor";
import { getConnection } from "./connections";
import { Retry } from "./retry";
import { downloadUniversalPackage } from "./universal";

tl.setResourcePath(path.join(__dirname, "task.json"));

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
    const skipDownload = tl.getVariable("Packaging.SkipDownload") === "true";

    try {
        if (skipDownload) {
            tl.debug("Download Package skipped.");
            return Promise.resolve();
        }
    
        if(packageType === "Universal") {
            return await downloadUniversalPackage(downloadPath, feedId, packageId, version);
        }
    
        if (viewId && viewId.replace(/\s/g, "") !== "") {
            feedId = feedId + "@" + viewId;
        }
    
        let files: string[] = [];
        if (filesPattern) {
            files = nutil.getPatternsArrayFromInput(filesPattern);
        }
    
        var feedConnection = await getConnection("7AB4E64E-C4D8-4F50-AE73-5EF2E21642A5", collectionUrl);
        var pkgsConnection = await getConnection("B3BE7473-68EA-4A81-BFC7-9530BAAA19AD", collectionUrl);
    
        var p = await new PackageUrlsBuilder()
            .ofType(packageType)
            .withPkgsConnection(pkgsConnection)
            .withFeedsConnection(feedConnection)
            .matchingPattern(files)
            .withRetries(Retry(retryLimit))
            .build();
    
        var extractors: Extractor[] = await p.download(feedId, packageId, version, downloadPath);
    
        if (packageType === "npm" || packageType === "nuget") {
            extractors.forEach(extractor => {
                extractor.process(extractPackage);
            });
        }
    
        return Promise.resolve();

    } finally {
        logTelemetry({
            packageType: packageType,
            feedId : feedId,
            viewId : viewId,
            packageId: packageId,
            version: version,
            filesPattern: filesPattern,
            collectionUrl: collectionUrl,
            skipDownload: skipDownload,
            extractPackage: extractPackage
        })
    }
   
}

function logTelemetry(params: any) {
    try {
        telemetry.emitTelemetry("Packaging", "DownloadPackagev1", params);
    } catch (err) {
        tl.debug(`Unable to log DownloadPackageV1 task telemetry. Err:( ${err} )`);
    }
}


main()
    .then(result => tl.setResult(tl.TaskResult.Succeeded, ""))
    .catch(error => tl.setResult(tl.TaskResult.Failed, error));
    