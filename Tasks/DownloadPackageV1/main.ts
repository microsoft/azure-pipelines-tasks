var path = require("path");

import * as tl from "azure-pipelines-task-lib/task";
import * as nutil from "packaging-common/nuget/Utility";
import * as telemetry from "utility-common/telemetry";

import { PackageUrlsBuilder } from "./packagebuilder";
import { PackageFile } from "./packagefile";
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

        if (packageType === "upack") {
            return await downloadUniversalPackage(downloadPath, feedId, packageId, version, filesPattern);
        }

        if (viewId && viewId.replace(/\s/g, "") !== "") {
            feedId = feedId + "@" + viewId;
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

        const packageFiles: PackageFile[] = await p.download(feedId, packageId, version, downloadPath, extractPackage);

        packageFiles.forEach(packageFile => {
            packageFile.process();
        });

        return Promise.resolve();

    } finally {
        logTelemetry({
            PackageType: packageType,
            FeedId : feedId,
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

main()
    .then(result => tl.setResult(tl.TaskResult.Succeeded, ""))
    .catch(error => tl.setResult(tl.TaskResult.Failed, error));
