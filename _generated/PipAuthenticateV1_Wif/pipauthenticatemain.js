"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const connectionDataUtils_1 = require("azure-pipelines-tasks-artifacts-common/connectionDataUtils");
const protocols_1 = require("azure-pipelines-tasks-artifacts-common/protocols");
const serviceConnectionUtils_1 = require("azure-pipelines-tasks-artifacts-common/serviceConnectionUtils");
const EntraWifUserServiceConnectionUtils_1 = require("azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils");
const feedUrlUtils_1 = require("azure-pipelines-tasks-artifacts-common/feedUrlUtils");
const stringUtils_1 = require("azure-pipelines-tasks-artifacts-common/stringUtils");
const telemetry_1 = require("azure-pipelines-tasks-artifacts-common/telemetry");
const webapi_1 = require("azure-pipelines-tasks-artifacts-common/webapi");
const tl = require("azure-pipelines-task-lib");
const path = require("path");
const utils = require("./utilities");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        tl.setResourcePath(path.join(__dirname, "task.json"));
        let internalFeedSuccessCount = 0;
        let externalFeedSuccessCount = 0;
        let federatedFeedAuthSuccessCount = 0;
        try {
            const feedUrl = tl.getInput("feedUrl");
            const entraWifServiceConnectionName = tl.getInput("workloadIdentityServiceConnection");
            // If using feed Url and wif service connection, set the pip index url
            if (feedUrl && entraWifServiceConnectionName) {
                tl.debug(tl.loc("Info_AddingFederatedFeedAuth", entraWifServiceConnectionName, feedUrl));
                const credentials = yield (0, EntraWifUserServiceConnectionUtils_1.getFederatedWorkloadIdentityCredentialsForFeed)(entraWifServiceConnectionName, (0, feedUrlUtils_1.parseAzureArtifactsFeedUrl)(feedUrl), protocols_1.ProtocolType.PyPi);
                if (credentials) {
                    var indexUrl = utils.addCredentialsToUri(entraWifServiceConnectionName, credentials.accessToken, credentials.feedUrl.href);
                    tl.setVariable("PIP_INDEX_URL", indexUrl, false);
                    federatedFeedAuthSuccessCount++;
                    console.log(tl.loc("Info_SuccessAddingFederatedFeedAuth", feedUrl));
                }
                else {
                    throw new Error(tl.loc("FailedToGetServiceConnectionAuth", entraWifServiceConnectionName));
                }
                return;
            }
            let internalAndExternalEndpoints = [];
            const feedList = tl.getDelimitedInput("artifactFeeds", ",");
            const onlyAddExtraIndex = tl.getBoolInput("onlyAddExtraIndex");
            const pypiSimpleApiLocationId = "93377A2C-F5FB-48B9-A8DC-7781441CABF1";
            const pypiApiVersion = "5.0";
            // Local feeds
            if (feedList) {
                tl.debug(tl.loc("Info_AddingInternalFeeds", feedList.length));
                const localAccessToken = (0, webapi_1.getSystemAccessToken)();
                for (const feedName of feedList) {
                    const feed = (0, stringUtils_1.getProjectScopedFeed)(feedName);
                    const feedUri = yield (0, connectionDataUtils_1.getPackagingRouteUrl)(protocols_1.ProtocolType.PyPi, pypiApiVersion, pypiSimpleApiLocationId, feed.feedId, feed.projectId);
                    const verifiedFeedUri = yield (0, feedUrlUtils_1.verifyAzureArtifactsFeedUrl)(new URL(feedUri), protocols_1.ProtocolType.PyPi);
                    const pipUri = utils.addCredentialsToUri("build", localAccessToken, verifiedFeedUri.href);
                    internalAndExternalEndpoints.push(pipUri);
                }
            }
            // external service endpoints
            const externalEndpoints = (0, serviceConnectionUtils_1.getPackagingServiceConnections)("pythonDownloadServiceConnections");
            externalEndpoints.forEach((id) => {
                const externalPipUri = utils.getUriWithCredentials(id);
                internalAndExternalEndpoints.push(externalPipUri);
            });
            // Setting pip_index_url if onlyaddExtraIndex is false
            let pipIndexEnvVar = "";
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
                if (pipauthvar.length < extraIndexUrl.length) {
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
        }
        finally {
            (0, telemetry_1.emitTelemetry)("Packaging", "PipAuthenticateV1", {
                "InternalFeedAuthCount": internalFeedSuccessCount,
                "ExternalFeedAuthCount": externalFeedSuccessCount,
                "FederatedFeedAuthCount": federatedFeedAuthSuccessCount
            });
        }
    });
}
main();
