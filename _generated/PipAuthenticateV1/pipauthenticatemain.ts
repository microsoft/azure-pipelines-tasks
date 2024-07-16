import { getPackagingRouteUrl } from "azure-pipelines-tasks-artifacts-common/connectionDataUtils";
import { ProtocolType } from "azure-pipelines-tasks-artifacts-common/protocols";
import { getPackagingServiceConnections } from "azure-pipelines-tasks-artifacts-common/serviceConnectionUtils";
import { getProjectScopedFeed } from "azure-pipelines-tasks-artifacts-common/stringUtils";
import { emitTelemetry } from "azure-pipelines-tasks-artifacts-common/telemetry";
import { getSystemAccessToken } from "azure-pipelines-tasks-artifacts-common/webapi";
import * as tl from "azure-pipelines-task-lib";
import * as path from "path";
import * as utils from "./utilities";

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, "task.json"));

    let internalFeedSuccessCount: number = 0;
    let externalFeedSuccessCount: number = 0;
    try {
        let internalAndExternalEndpoints: string[] = [];

        const feedList  = tl.getDelimitedInput("artifactFeeds", ",");
        const onlyAddExtraIndex = tl.getBoolInput("onlyAddExtraIndex");

        const pypiSimpleApiLocationId: string = "93377A2C-F5FB-48B9-A8DC-7781441CABF1";
        const pypiApiVersion: string = "5.0";

        // Local feeds
        if (feedList)
        {
            tl.debug(tl.loc("Info_AddingInternalFeeds", feedList.length));
            const localAccessToken = getSystemAccessToken();

            for (const feedName of feedList) {
                const feed = getProjectScopedFeed(feedName);
                const feedUri = await getPackagingRouteUrl(
                    ProtocolType.PyPi,
                    pypiApiVersion,
                    pypiSimpleApiLocationId,
                    feed.feedId,
                    feed.projectId);
                const pipUri = utils.addCredentialsToUri("build", localAccessToken, feedUri);
                internalAndExternalEndpoints.push(pipUri);
            }
        }

        // external service endpoints
        const externalEndpoints = getPackagingServiceConnections("pythonDownloadServiceConnections");
        externalEndpoints.forEach((id) => {
            const externalPipUri = utils.getUriWithCredentials(id);
            internalAndExternalEndpoints.push(externalPipUri);
        });

        // Setting pip_index_url if onlyaddExtraIndex is false
        let pipIndexEnvVar: string = "";
        if (!onlyAddExtraIndex && internalAndExternalEndpoints.length > 0) {
            pipIndexEnvVar = internalAndExternalEndpoints[0];
            internalAndExternalEndpoints.shift();
            tl.setVariable("PIP_INDEX_URL", pipIndexEnvVar, false);
        }

        // Setting pip_extra_index_url for rest of the endpoints
        if (internalAndExternalEndpoints.length > 0) {
            const extraIndexUrl = internalAndExternalEndpoints.join(" ");
            tl.setVariable("PIP_EXTRA_INDEX_URL", extraIndexUrl, false);

            const pipauthvar = tl.getVariable("PIP_EXTRA_INDEX_URL");
            if (pipauthvar.length < extraIndexUrl.length){
                tl.warning(tl.loc("Warn_TooManyFeedEntries"));
            }
        }

        internalFeedSuccessCount = feedList.length;
        externalFeedSuccessCount = externalEndpoints.length;
        console.log(tl.loc("Info_SuccessAddingAuth", internalFeedSuccessCount, externalFeedSuccessCount));
    }
    catch (error) {
        tl.error(error);
        tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToAddAuthentication"));
        return;
    } finally{
        emitTelemetry("Packaging", "PipAuthenticateV1", {
            "InternalFeedAuthCount": internalFeedSuccessCount,
            "ExternalFeedAuthCount": externalFeedSuccessCount,
        });
    }
}

main();
