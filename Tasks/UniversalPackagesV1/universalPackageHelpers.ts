import * as tl from "azure-pipelines-task-lib";
import * as telemetry from "azure-pipelines-tasks-utility-common/telemetry";
import { getSystemAccessToken, getWebApiWithProxy } from "azure-pipelines-tasks-artifacts-common/webapi";
import { getFederatedWorkloadIdentityCredentials } from "azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils";
import { retryOnException } from "azure-pipelines-tasks-artifacts-common/retryUtils";
import * as clientToolUtils from "azure-pipelines-tasks-packaging-common/universal/ClientToolUtilities";
import * as artifactToolUtilities from "azure-pipelines-tasks-packaging-common/universal/ArtifactToolUtilities";
import * as artifactToolRunner from "azure-pipelines-tasks-packaging-common/universal/ArtifactToolRunner";
import { getFeedUriFromBaseServiceUri } from "azure-pipelines-tasks-packaging-common/locationUtilities";
import { UniversalPackageContext } from "./UniversalPackageContext";

// Re-export for use by download/publish modules
export { artifactToolRunner };

export async function trySetAuth(context: UniversalPackageContext): Promise<boolean> {
    try {
        const toolRunnerOptions = artifactToolRunner.getOptions();
        let accessToken: string | undefined;

        if (context.adoServiceConnection) {
            tl.debug(tl.loc('Debug_UsingWifAuth', context.adoServiceConnection));
            try {
                accessToken = await getFederatedWorkloadIdentityCredentials(context.adoServiceConnection);
                if (accessToken) {
                    tl.debug(tl.loc('Debug_WifTokenObtained'));
                } else {
                    tl.warning(tl.loc('Warning_WifAuthNoToken', context.adoServiceConnection));
                }
            } catch (err) {
                tl.warning(tl.loc('Warning_WifAuthFailed', context.adoServiceConnection, err));
            }
        }

        accessToken ??= getSystemAccessToken();

        if (!accessToken) {
            throw new Error(tl.loc('Error_NoAuthToken'));
        }

        tl.debug(tl.loc('Debug_UsingBuildServiceCreds'));

        // Get serviceUri based on whether we're using a service connection
        let serviceUri: string;
        if (context.adoServiceConnection) {
            // Using service connection: organization must be specified for cross-org scenario
            if (!context.organization) {
                throw new Error(tl.loc('Error_OrganizationRequired'));
            }
            serviceUri = `https://dev.azure.com/${encodeURIComponent(context.organization)}`;
        } else {
            // Using pipeline identity: get serviceUri from SYSTEMVSSCONNECTION
            serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
        }

        tl.debug(tl.loc('Debug_UsingServiceUri', serviceUri));

        toolRunnerOptions.env.UNIVERSAL_AUTH_TOKEN = accessToken;

        context.accessToken = accessToken;
        context.serviceUri = serviceUri;
        context.toolRunnerOptions = toolRunnerOptions;
        return true;
    } catch (error) {
        handleTaskError(error, tl.loc('Error_AuthenticationFailed'));
        return false;
    }
}

export async function trySetFeed(context: UniversalPackageContext): Promise<boolean> {
    try {
        tl.debug(tl.loc('Debug_ParsedFeedInfo', context.serviceUri, context.projectAndFeed));

        const { feedName, projectName } = parseFeedInput(context.projectAndFeed);

        // Validate organization, token, and feed access
        tl.debug(tl.loc('Debug_ValidatingOrganization', context.serviceUri));
        
        const packagingUrl = await getFeedUriFromBaseServiceUri(context.serviceUri, context.accessToken);
        
        // Validate feed exists and token has access by calling the Feeds API
        await validateFeedAccess(packagingUrl, feedName, projectName, context.accessToken);

        tl.debug(tl.loc('Debug_ValidatedServiceUri', context.serviceUri));

        context.feedName = feedName;
        context.projectName = projectName;
        return true;
    } catch (error) {
        handleTaskError(error, tl.loc('Error_FailedToValidateFeed', context.serviceUri, context.projectAndFeed));
        return false;
    }
}

async function validateFeedAccess(packagingUrl: string, feedId: string, projectId: string | null, accessToken: string): Promise<void> {
    const webApi = getWebApiWithProxy(packagingUrl, accessToken);
    
    // Use the Package API to validate feed exists and token has access
    // These values come from ArtifactToolUtilities.ts in packaging-common
    const ApiVersion = "3.0-preview.1";
    const PackagingAreaName = "Packaging";
    const PackageAreaId = "7a20d846-c929-4acc-9ea2-0d5a7df1b197";
    
    let routeValues: any = { feedId: feedId };
    if (projectId) {
        routeValues.project = projectId;
    }
    
    // This will throw if the feed doesn't exist or token doesn't have access
    const data = await webApi.vsoClient.getVersioningData(ApiVersion, PackagingAreaName, PackageAreaId, routeValues);
    tl.debug(tl.loc('Debug_FeedValidationSuccess', data.requestUrl));
}

export async function tryDownloadArtifactTool(context: UniversalPackageContext): Promise<boolean> {
    tl.debug(tl.loc('Debug_GettingArtifactTool'));
    
    try {
        const localAccessToken = getSystemAccessToken();
        const serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
        const blobUri = await clientToolUtils.getBlobstoreUriFromBaseServiceUri(
            serviceUri,
            localAccessToken);

        tl.debug(tl.loc("Debug_RetrievingArtifactToolUri", blobUri));

        const artifactToolPath = await retryOnException(
            () => artifactToolUtilities.getArtifactToolFromService(
                blobUri,
                localAccessToken,
                "artifacttool"), 3, 1000);

        tl.debug(tl.loc("Debug_ArtifactToolPath", artifactToolPath));
        
        context.artifactToolPath = artifactToolPath;
        return true;
    } catch (error) {
        const errorMessage = tl.loc("Error_FailedToGetArtifactTool", error.message);
        handleTaskError(error, errorMessage);
        return false;
    } finally {
        logUniversalStartupTelemetry(context.artifactToolPath);
    }
}

function parseFeedInput(feed: string): { feedName: string; projectName: string | null } {
    let feedName: string;
    let projectName: string = null;
    
    if (feed.includes('/')) {
        const feedParts = feed.split('/');
        projectName = feedParts[0];
        feedName = feedParts[1];
        tl.debug(tl.loc('Debug_ProjectScopedFeed', projectName, feedName));
    } else {
        feedName = feed;
        tl.debug(tl.loc('Debug_OrgScopedFeed', feedName));
    }

    return {
        feedName,
        projectName
    };
}

export function handleTaskError(err: any, errorMessage: string, context?: UniversalPackageContext): void {
    tl.error(err);

    const buildIdentityDisplayName = tl.getVariable('Build.RequestedFor') || 
                                    tl.getVariable('Release.RequestedFor') ||
                                    tl.getVariable('Agent.Name') || 
                                    '[Build Service Account]';
    const buildIdentityAccount = tl.getVariable('Build.RequestedForId') || '[Build Service]';
    
    tl.warning(tl.loc("Warning_BuildIdentityOperationHint", buildIdentityDisplayName, buildIdentityAccount));
    
    if (context && context.organization && context.feedName) {
        const feedUrl = constructFeedPermissionsUrl(context.organization, context.projectName, context.feedName);
        tl.warning(tl.loc("Warning_BuildIdentityFeedHint", context.feedName, feedUrl));
    }

    tl.setResult(tl.TaskResult.Failed, errorMessage);
}

function constructFeedPermissionsUrl(organizationName: string, projectName: string | null | undefined, feedName: string): string {
    const baseUrl = `https://dev.azure.com/${encodeURIComponent(organizationName)}`;
    if (projectName) {
        return `${baseUrl}/${encodeURIComponent(projectName)}/_artifacts/feed/${encodeURIComponent(feedName)}/settings/permissions`;
    } else {
        return `${baseUrl}/_artifacts/feed/${encodeURIComponent(feedName)}/settings/permissions`;
    }
}

export function validateServerType(): boolean {
    try {
        const serverType = tl.getVariable("System.ServerType");
        if (!serverType || serverType.toLowerCase() !== "hosted") {
            throw new Error(tl.loc("Error_UniversalPackagesNotSupportedOnPrem"));
        }
        return true;
    } catch (error) {
        handleTaskError(error, tl.loc("Error_UniversalPackagesNotSupportedOnPrem"));
        return false;
    }
}

export function logUniversalStartupTelemetry(artifactToolPath: string): void {
    try {
        let universalPackagesTelemetry = {
            "command": tl.getInput("command"),
            "organization": tl.getInput("organization"),
            "feed": tl.getInput("feed"),
            "packageName": tl.getInput("packageName"),
            "adoServiceConnection": tl.getInput("adoServiceConnection"),
            "System.TeamFoundationCollectionUri": tl.getVariable("System.TeamFoundationCollectionUri"),
            "verbosity": tl.getInput("verbosity"),
            "artifactToolPath": artifactToolPath,
        };

        telemetry.emitTelemetry("Packaging", "UniversalPackagesV1", universalPackagesTelemetry);
    } catch (err) {
        tl.debug(tl.loc('Debug_TelemetryInitFailed', err));
    }
}

export function logCommandResult(area: string, feature: string, resultCode: number): void {
    try {
        telemetry.logResult(area, feature, resultCode);
    } catch (err) {
        tl.debug(tl.loc('Debug_TelemetryResultFailed', err));
    }
}