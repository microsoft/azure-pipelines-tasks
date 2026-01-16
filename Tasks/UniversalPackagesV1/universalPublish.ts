import * as tl from "azure-pipelines-task-lib";
import { IExecSyncResult } from "azure-pipelines-task-lib/toolrunner";
import { getWebApiWithProxy } from "azure-pipelines-tasks-artifacts-common/webapi";
import { ProvenanceHelper, SessionRequest, SessionResponse } from "azure-pipelines-tasks-packaging-common/provenance";
import { retryOnException } from "azure-pipelines-tasks-artifacts-common/retryUtils";
import { UniversalPackageContext } from "./UniversalPackageContext";
import * as helpers from "./universalPackageHelpers";
import * as restClient from 'typed-rest-client/RestClient';

export async function run(context: UniversalPackageContext): Promise<void> {
    tl.debug(tl.loc('Debug_PublishOperation', context.packageName, context.packageVersion, context.directory));
    
    // Get provenance session ID if using service connection, otherwise use feedName
    // Build Service provides metadata automatically; service connections require provenance
    const feedId = context.adoServiceConnection
        ? await tryGetProvenanceSessionId(context)
        : context.feedName;

    // Publish the package
    try {
        tl.debug(tl.loc("Debug_UsingArtifactToolPublish"));
        publishPackageUsingArtifactTool(context, feedId);
        tl.setResult(tl.TaskResult.Succeeded, tl.loc("Success_PackagesPublished"));
    } catch (err) {
        await helpers.handleTaskError(err, tl.loc('Error_PackagesFailedToPublish'), context);
    }
}

function publishPackageUsingArtifactTool(context: UniversalPackageContext, feedId: string) {
    const command = new Array<string>();
    command.push(
        "universal", "publish",
        "--feed", feedId,
        "--service", context.serviceUri,
        "--package-name", context.packageName,
        "--package-version", context.packageVersion,
        "--path", context.directory,
        "--patvar", "UNIVERSAL_AUTH_TOKEN",
        "--verbosity", context.verbosity);

    if (context.projectName) {
        command.push("--project", context.projectName);
    }

    if (context.packageDescription) {
        command.push("--description", context.packageDescription);
    }

    tl.debug(tl.loc("Debug_Publishing", context.packageName, context.packageVersion, feedId, context.projectName));
    const execResult: IExecSyncResult = helpers.artifactToolRunner.runArtifactTool(
        context.artifactToolPath,
        command,
        context.toolRunnerOptions);

    if (execResult.code === 0) {
        return;
    }

    helpers.logCommandResult("Packaging", "UniversalPackagesCommand", execResult.code);
    throw new Error(tl.loc("Error_UnexpectedErrorArtifactToolPublish",
        execResult.code,
        execResult.stderr ? execResult.stderr.trim() : execResult.stderr));
}

async function tryGetProvenanceSessionId(context: UniversalPackageContext): Promise<string> {
    // Break glass pipeline variable to disable provenance
    const saveMetadata = tl.getVariable("Packaging.SavePublishMetadata");
    if (saveMetadata && saveMetadata.toLowerCase() === 'false') {
        tl.debug(tl.loc('Debug_ProvenanceDisabled'));
        return context.feedName;
    }

    try {
        // Get the Universal Packages service URL using UPack area ID
        const packagingUrl = await getUniversalPackagesUri(context);
        tl.debug(tl.loc('Debug_ResolvedPackagingUrl', packagingUrl));
        
        // Get versioning data for the provenance session API
        const webApi = getWebApiWithProxy(packagingUrl, context.accessToken);
        const routeValues: any = {
            protocol: "upack",
            project: context.projectName
        };
        
        const verData = await webApi.vsoClient.getVersioningData(
            "7.1-preview.1",
            "Provenance",
            "503B4E54-EBF4-4D04-8EEE-21C00823C2AC",
            routeValues);
        
        tl.debug(tl.loc('Debug_ProvenanceApiUrl', verData.requestUrl));
        
        // Make REST call to create provenance session
        const sessionRequest: SessionRequest = ProvenanceHelper.CreateSessionRequest(context.feedName);
        
        // Use the same request options pattern as ProvenanceApi in packaging-common
        const requestOptions: restClient.IRequestOptions = {
            acceptHeader: `application/json; api-version=${verData.apiVersion}`,
            additionalHeaders: { 
                'Content-Type': 'application/json'
            }
        };
        
        const response: restClient.IRestResponse<SessionResponse> = await webApi.rest.create<SessionResponse>(
            verData.requestUrl,
            sessionRequest,
            requestOptions);
        
        tl.debug(tl.loc('Debug_ProvenanceResponseStatus', response.statusCode));
        
        const session = response.result;
        if (session && session.sessionId) {
            tl.debug(tl.loc('Debug_UsingProvenanceSession', session.sessionId));
            return session.sessionId;
        } else {
            tl.debug(tl.loc('Debug_NoProvenanceSession'));
            return context.feedName;
        }
    } catch (err) {
        tl.warning(tl.loc('Warning_ProvenanceSessionFailed', err.message || err));
        return context.feedName;
    }
}

async function getUniversalPackagesUri(context: UniversalPackageContext): Promise<string> {
    const upackAreaId = 'd397749b-f115-4027-b6dd-77a65dd10d21';
    const webApi = getWebApiWithProxy(context.serviceUri, context.accessToken);
    const locationApi = await webApi.getLocationsApi();
    const resourceArea = await retryOnException(() => locationApi.getResourceArea(upackAreaId), 3, 1000);
    return resourceArea.locationUrl;
}
