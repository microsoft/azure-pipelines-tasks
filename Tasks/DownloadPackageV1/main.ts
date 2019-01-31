var path = require("path");

import * as tl from "vsts-task-lib/task";
import * as nutil from "packaging-common/nuget/Utility";

import { PackageUrlsBuilder } from "./packagebuilder";
import { Extractor } from "./extractor";
import { getConnection } from "./connections";

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
    const skipDownload = tl.getVariable("skipDownload") === "true";

    if (skipDownload) {
        tl.debug("Download Package skipped.");
        return Promise.resolve();
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
        .build();

    var extractors: Extractor[] = await executeWithRetries(
        "downloadPackage",
        () =>
            p.download(feedId, packageId, version, downloadPath).catch(reason => {
                throw reason;
            }),
        retryLimit
    );
    
    if (extractPackage) {
        extractors.forEach(extractor => {
            extractor.extractFile();
        });
    }

    return Promise.resolve();
}

function executeWithRetries(operationName: string, operation: () => Promise<any>, retryCount): Promise<any> {
    var executePromise = new Promise((resolve, reject) => {
        executeWithRetriesImplementation(operationName, operation, retryCount, resolve, reject);
    });

    return executePromise;
}

function executeWithRetriesImplementation(
    operationName: string,
    operation: () => Promise<any>,
    currentRetryCount,
    resolve,
    reject
) {
    operation()
        .then(result => {
            resolve(result);
        })
        .catch(error => {
            if (currentRetryCount <= 0) {
                tl.error(tl.loc("OperationFailed", operationName, error));
                reject(error);
            } else {
                console.log(tl.loc("RetryingOperation", operationName, currentRetryCount));
                currentRetryCount = currentRetryCount - 1;
                setTimeout(
                    () =>
                        executeWithRetriesImplementation(operationName, operation, currentRetryCount, resolve, reject),
                    4 * 1000
                );
            }
        });
}

main()
    .then(result => tl.setResult(tl.TaskResult.Succeeded, ""))
    .catch(error => tl.setResult(tl.TaskResult.Failed, error));
