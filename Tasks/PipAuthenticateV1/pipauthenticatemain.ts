import { getPackagingServiceConnections } from "azure-pipelines-tasks-artifacts-common/serviceConnectionUtils";
import { emitTelemetry } from "azure-pipelines-tasks-artifacts-common/telemetry";
import { getSystemAccessToken } from "azure-pipelines-tasks-artifacts-common/webapi";
import * as tl from "azure-pipelines-task-lib";
import * as path from "path";
import * as utils from "./utilities";

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, "task.json"));

    let internalFeedSuccessCount: number = 0;
    let externalFeedSuccessCount: number = 0;
    let federatedFeedAuthSuccessCount: number = 0;

    try {
#if WIF
        const feedUrl = tl.getInput("feedUrl");
        const entraWifServiceConnectionName = tl.getInput("workloadIdentityServiceConnection");

        // Both inputs must be provided together — providing only one is a misconfiguration.
        if (feedUrl && !entraWifServiceConnectionName) {
            throw new Error(tl.loc("Error_MissingWifServiceConnection"));
        }
        if (entraWifServiceConnectionName && !feedUrl) {
            throw new Error(tl.loc("Error_MissingWifFeedUrl"));
        }

        if (feedUrl && entraWifServiceConnectionName) {
            tl.debug(tl.loc("Info_AddingFederatedFeedAuth", entraWifServiceConnectionName, feedUrl));
            tl.setVariable("PIP_INDEX_URL", await utils.buildWifFeedUri(entraWifServiceConnectionName, feedUrl), false);
            federatedFeedAuthSuccessCount++;
            console.log(tl.loc("Info_SuccessAddingFederatedFeedAuth", feedUrl));
            return;
        }
#endif

        const feedList = tl.getDelimitedInput("artifactFeeds", ",");
        const onlyAddExtraIndex = tl.getBoolInput("onlyAddExtraIndex");

        const internalEndpoints = await utils.buildInternalFeedUris(feedList, getSystemAccessToken());
        const externalEndpoints = utils.buildExternalFeedUris(getPackagingServiceConnections("pythonDownloadServiceConnections"));

        utils.setPipIndexVariables([...internalEndpoints, ...externalEndpoints], onlyAddExtraIndex);

        internalFeedSuccessCount = internalEndpoints.length;
        externalFeedSuccessCount = externalEndpoints.length;
        console.log(tl.loc("Info_SuccessAddingAuth", internalFeedSuccessCount, externalFeedSuccessCount));
    } catch (error) {
        tl.error(error);
        tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToAddAuthentication"));
    } finally {
        emitTelemetry("Packaging", "PipAuthenticateV1", {
            "InternalFeedAuthCount": internalFeedSuccessCount,
            "ExternalFeedAuthCount": externalFeedSuccessCount,
            "FederatedFeedAuthCount": federatedFeedAuthSuccessCount,
        });
    }
}

main();
