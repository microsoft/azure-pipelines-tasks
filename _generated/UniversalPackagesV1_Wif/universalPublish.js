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
exports.run = run;
const tl = require("azure-pipelines-task-lib");
const retryUtils_1 = require("azure-pipelines-tasks-artifacts-common/retryUtils");
const webapi_1 = require("azure-pipelines-tasks-artifacts-common/webapi");
const webapi_2 = require("azure-pipelines-tasks-artifacts-common/webapi");
const provenance_1 = require("azure-pipelines-tasks-packaging-common/provenance");
const artifactToolUtilities = require("azure-pipelines-tasks-packaging-common/universal/ArtifactToolUtilities");
const helpers = require("./universalPackageHelpers");
function run(context) {
    return __awaiter(this, void 0, void 0, function* () {
        let packageVersion = context.packageVersion;
        try {
            // Resolve packageVersion if using versionIncrement
            if (context.versionIncrement) {
                packageVersion = yield resolveVersionIncrement(context);
            }
            helpers.logInfo('Info_PublishingPackage', context.packageName, packageVersion, context.directory);
            // Get provenance session ID for publish traceability
            const feedId = yield getProvenanceSessionId(context);
            // Publish the package
            tl.debug(tl.loc("Debug_UsingArtifactToolPublish"));
            publishPackageUsingArtifactTool(context, feedId, packageVersion);
            tl.setVariable('packageName', context.packageName, false, true);
            tl.setVariable('packageVersion', packageVersion, false, true);
            tl.debug(tl.loc('Debug_SetOutputVariables', context.packageName, packageVersion));
            helpers.logInfo("Success_PackagesPublished", context.packageName, packageVersion, context.feedName);
            tl.setResult(tl.TaskResult.Succeeded, tl.loc("Success_PackagesPublished", context.packageName, packageVersion, context.feedName));
        }
        catch (err) {
            yield helpers.handleTaskError(err, tl.loc('Error_PackagesFailedToPublish', context.packageName, packageVersion || context.versionIncrement, context.feedName), context);
        }
    });
}
function resolveVersionIncrement(context) {
    return __awaiter(this, void 0, void 0, function* () {
        tl.debug(tl.loc('Debug_ResolvingVersionIncrement', context.versionIncrement));
        // Query the feed for the highest existing version
        // Must use feedServiceUri (https://feeds.dev.azure.com) not serviceUri (https://dev.azure.com)
        // because the Packaging API is hosted on the feeds subdomain
        const highestVersion = yield artifactToolUtilities.getHighestPackageVersionFromFeed(context.feedServiceUri, context.accessToken, context.projectName, context.feedName, context.packageName);
        tl.debug(tl.loc('Debug_HighestPackageVersion', highestVersion));
        // Increment the version based on the increment type
        const newVersion = artifactToolUtilities.getVersionUtility(context.versionIncrement, highestVersion);
        if (!newVersion) {
            throw new Error(tl.loc('Error_InvalidVersionIncrement', context.versionIncrement));
        }
        tl.debug(tl.loc('Debug_CalculatedVersion', newVersion));
        helpers.logInfo('Info_UsingIncrementedVersion', newVersion, context.versionIncrement, highestVersion);
        return newVersion;
    });
}
function publishPackageUsingArtifactTool(context, feedId, packageVersion) {
    const command = new Array();
    command.push("universal", "publish", "--feed", feedId, "--service", context.serviceUri, "--package-name", context.packageName, "--package-version", packageVersion, "--path", context.directory, "--patvar", "UNIVERSAL_AUTH_TOKEN", "--verbosity", context.verbosity);
    if (context.projectName) {
        command.push("--project", context.projectName);
    }
    if (context.packageDescription) {
        command.push("--description", context.packageDescription);
    }
    tl.debug(tl.loc("Debug_Publishing", context.packageName, packageVersion, feedId, context.projectName));
    const execResult = helpers.artifactToolRunner.runArtifactTool(context.artifactToolPath, command, context.toolRunnerOptions);
    if (execResult.code === 0) {
        return;
    }
    helpers.logCommandResult("Packaging", "UniversalPackagesCommand", execResult.code);
    throw new Error(tl.loc("Error_UnexpectedErrorArtifactToolPublish", execResult.code, execResult.stderr ? execResult.stderr.trim() : execResult.stderr));
}
function getProvenanceSessionId(context) {
    return __awaiter(this, void 0, void 0, function* () {
        // Break glass pipeline variable to disable provenance
        const saveMetadata = tl.getVariable("Packaging.SavePublishMetadata");
        if (saveMetadata && saveMetadata.toLowerCase() === 'false') {
            tl.debug(tl.loc('Debug_ProvenanceDisabled'));
            return context.feedName;
        }
        try {
            // Get the Universal Packages service URL using UPack area ID
            const packagingUrl = yield getUniversalPackagesUri(context);
            tl.debug(tl.loc('Debug_ResolvedPackagingUrl', packagingUrl));
            // Get versioning data for the provenance session API
            const webApi = (0, webapi_1.getWebApiWithProxy)(packagingUrl, context.accessToken);
            const routeValues = {
                protocol: "upack",
                project: context.projectName
            };
            const verData = yield webApi.vsoClient.getVersioningData("7.1-preview.1", "Provenance", "503B4E54-EBF4-4D04-8EEE-21C00823C2AC", routeValues);
            tl.debug(tl.loc('Debug_ProvenanceApiUrl', verData.requestUrl));
            // Make REST call to create provenance session
            const sessionRequest = provenance_1.ProvenanceHelper.CreateSessionRequest(context.feedName);
            // Use the same request options pattern as ProvenanceApi in packaging-common
            const requestOptions = {
                acceptHeader: `application/json; api-version=${verData.apiVersion}`,
                additionalHeaders: {
                    'Content-Type': 'application/json'
                }
            };
            const response = yield webApi.rest.create(verData.requestUrl, sessionRequest, requestOptions);
            tl.debug(tl.loc('Debug_ProvenanceResponseStatus', response.statusCode));
            const session = response.result;
            if (session && session.sessionId) {
                tl.debug(tl.loc('Debug_UsingProvenanceSession', session.sessionId));
                return session.sessionId;
            }
            else {
                tl.debug(tl.loc('Debug_NoProvenanceSession'));
                return context.feedName;
            }
        }
        catch (err) {
            tl.warning(tl.loc('Warning_ProvenanceSessionFailed', err.message || err));
            return context.feedName;
        }
    });
}
function getUniversalPackagesUri(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const upackAreaId = 'd397749b-f115-4027-b6dd-77a65dd10d21';
        const resourceArea = yield (0, retryUtils_1.retryOnException)(() => context.locationApi.getResourceArea(upackAreaId), 3, 1000);
        return (0, webapi_2.requireHttpsUrl)(resourceArea.locationUrl).href;
    });
}
