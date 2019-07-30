import * as path from "path";
import * as tl from "azure-pipelines-task-lib";
import * as pkgLocationUtils from "packaging-common/locationUtilities";
import * as telemetry from "utility-common/telemetry";
import * as auth from "./authentication";
import * as utils from "./utilities";
import { getProjectAndFeedIdFromInput } from 'packaging-common/util';

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, "task.json"));
    let internalFeedSuccessCount: number = 0;
    let externalFeedSuccessCount: number = 0;
    try {
        let packagingLocation: string;

        let internalAndExternalEndpoints: string[] = [];

        const feedList  = tl.getDelimitedInput("artifactFeeds", ",");
        const onlyAddExtraIndex = tl.getBoolInput("onlyAddExtraIndex");

        // Local feeds
        if (feedList)
        {
            tl.debug(tl.loc("Info_AddingInternalFeeds", feedList.length));
            const serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
            const localAccessToken = pkgLocationUtils.getSystemAccessToken();
            try {
                // This call is to get the packaging URI(abc.pkgs.vs.com) which is same for all protocols.
                packagingLocation = await pkgLocationUtils.getNuGetUriFromBaseServiceUri(
                    serviceUri,
                    localAccessToken);
            } catch (error) {
                tl.debug(tl.loc("FailedToGetPackagingUri"));
                tl.debug(JSON.stringify(error));
                packagingLocation = serviceUri;
            }

            for (const feedName of feedList) {
                const feed = getProjectAndFeedIdFromInput(feedName);
                const feedUri = await pkgLocationUtils.getFeedRegistryUrl(
                    packagingLocation,
                    pkgLocationUtils.RegistryType.PyPiSimple,
                    feed.feedId,
                    feed.projectId,
                    localAccessToken);
                const pipUri = utils.addCredentialsToUri("build", localAccessToken, feedUri);
                internalAndExternalEndpoints.push(pipUri);
            }
        }

        // external service endpoints
        const endpointNames = tl.getDelimitedInput("pythonDownloadServiceConnections", ",");

        const externalEndpoints = auth.getExternalAuthInfoArray(endpointNames);
        externalEndpoints.forEach((id) => {
            const externalPipUri = utils.addCredentialsToUri(id.username, id.password, id.packageSource.feedUri);
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
        _logPipAuthStartupVariables(internalFeedSuccessCount, externalFeedSuccessCount);
    }
}

// Telemetry
function _logPipAuthStartupVariables(internalFeedSuccessCount: number, externalFeedSuccessCount: number) {
    try {
        const pipAuthenticateTelemetry = {
            "InternalFeedAuthCount": internalFeedSuccessCount,
            "ExternalFeedAuthCount": externalFeedSuccessCount,
            };

        telemetry.emitTelemetry("Packaging", "PipAuthenticate", pipAuthenticateTelemetry);
    } catch (err) {
        tl.debug(`Unable to log Pip Authenticate task init telemetry. Err:( ${err} )`);
    }
}

main();
