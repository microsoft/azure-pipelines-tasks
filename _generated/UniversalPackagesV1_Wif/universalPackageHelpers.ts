import * as tl from "azure-pipelines-task-lib";
import * as telemetry from "azure-pipelines-tasks-utility-common/telemetry";
import { getFederatedWorkloadIdentityCredentials } from "azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils";
import { retryOnException } from "azure-pipelines-tasks-artifacts-common/retryUtils";
import { getProjectScopedFeed } from "azure-pipelines-tasks-artifacts-common/stringUtils";
import { getWebApiWithProxy } from "azure-pipelines-tasks-artifacts-common/webapi";
import { getFeedUriFromBaseServiceUri } from "azure-pipelines-tasks-packaging-common/locationUtilities";
import * as artifactToolRunner from "azure-pipelines-tasks-packaging-common/universal/ArtifactToolRunner";
import * as artifactToolUtilities from "azure-pipelines-tasks-packaging-common/universal/ArtifactToolUtilities";
import * as clientToolUtils from "azure-pipelines-tasks-packaging-common/universal/ClientToolUtilities";
import { UniversalPackageContext, OperationType } from "./UniversalPackageContext";

// Re-export for use by download/publish modules
export { artifactToolRunner };

// =============================================================================
// Validation (called first by universalMain)
// =============================================================================

export async function validateServerType(): Promise<boolean> {
    try {
        const serverType = tl.getVariable("System.ServerType");
        if (!serverType || serverType.toLowerCase() !== "hosted") {
            throw new Error(tl.loc("Error_UniversalPackagesNotSupportedOnPrem"));
        }
        return true;
    } catch (error) {
        await handleTaskError(error, tl.loc("Error_UniversalPackagesNotSupportedOnPrem"), undefined);
        return false;
    }
}

export function validateVersionInputs(context: UniversalPackageContext): boolean {
    if (context.command === OperationType.Download) {
        // Download requires packageVersion
        if (!context.packageVersion) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("Error_PackageVersionRequired"));
            return false;
        }
    } else if (context.command === OperationType.Publish) {
        // Publish requires exactly one of packageVersion or versionIncrement
        if (context.packageVersion && context.versionIncrement) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("Error_VersionInputsMutuallyExclusive"));
            return false;
        }

        if (!context.packageVersion && !context.versionIncrement) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("Error_VersionInputRequired"));
            return false;
        }
    }
    return true;
}

// =============================================================================
// Authentication
// =============================================================================

// Get system access token from SYSTEMVSSCONNECTION endpoint
function getSystemAccessToken(): string | undefined {
    const auth = tl.getEndpointAuthorization('SYSTEMVSSCONNECTION', false);
    return auth?.parameters?.['AccessToken'];
}

function tryGetSystemAccessToken(context: UniversalPackageContext): boolean {
    tl.debug(tl.loc('Debug_UsingBuildServiceCreds'));
    context.accessToken = getSystemAccessToken();
    return !!context.accessToken;
}

// Discover the tenant ID for the target feed by making a HEAD request.
// The X-VSS-ResourceTenant header is only returned on HEAD requests, not GET.
async function getFeedTenantId(feedUrl: string): Promise<string | undefined> {
    try {
        const response = await fetch(feedUrl, { method: 'HEAD' });
        return response?.headers?.get('X-VSS-ResourceTenant') ?? undefined;
    } catch (error) {
        tl.debug(tl.loc('Debug_FailedToGetFeedTenantId', feedUrl, error));
        return undefined;
    }
}

async function tryGetWifToken(context: UniversalPackageContext): Promise<boolean> {
    tl.debug(tl.loc('Debug_UsingWifAuth', context.adoServiceConnection));
    
    try {
        const feedTenant = await getFeedTenantId(context.feedServiceUri);
        tl.debug(tl.loc('Debug_DiscoveredTenant', feedTenant || 'none'));

        context.accessToken = await getFederatedWorkloadIdentityCredentials(context.adoServiceConnection, feedTenant);
        if (context.accessToken) {
            tl.debug(tl.loc('Debug_WifTokenObtained'));
            return true;
        } else {
            tl.warning(tl.loc('Warning_WifAuthNoToken', context.adoServiceConnection));
            return false;
        }
    } catch (err) {
        tl.warning(tl.loc('Warning_WifAuthFailed', context.adoServiceConnection, err));
        return false;
    }
}

async function trySetAccessToken(context: UniversalPackageContext): Promise<boolean> {
    if (context.adoServiceConnection) {
        return await tryGetWifToken(context);
    }
    return tryGetSystemAccessToken(context);
}

// Resolve service URIs using the location API's resource areas endpoint.
// The resource areas endpoint is publicly accessible and does not require authentication,
// so we can resolve feedServiceUri before obtaining an access token.
async function setServiceUris(context: UniversalPackageContext): Promise<void> {
    if (context.adoServiceConnection) {
        if (!context.organization) {
            throw new Error(tl.loc('Error_OrganizationRequired'));
        }
        context.serviceUri = `https://dev.azure.com/${encodeURIComponent(context.organization)}`;
    } else {
        context.serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
    }
    tl.debug(tl.loc('Debug_UsingServiceUri', context.serviceUri));

    try {
        context.feedServiceUri = await getFeedUriFromBaseServiceUri(context.serviceUri, "");
        tl.debug(tl.loc('Debug_FeedServiceUri', context.feedServiceUri));
    } catch (error) {
        throw new Error(tl.loc('Error_FailedToResolveFeedUri', context.serviceUri, error.message || error));
    }
}

async function setIdentityInformation(context: UniversalPackageContext): Promise<void> {
    try {
        tl.debug(tl.loc('Debug_CreatingLocationApi'));
        const webApi = getWebApiWithProxy(context.serviceUri, context.accessToken);
        context.locationApi = await webApi.getLocationsApi();

        tl.debug(tl.loc('Debug_GettingConnectionData'));
        const connectionData = await context.locationApi.getConnectionData();
        const identity = connectionData?.authenticatedUser;
        if (identity) {
            context.authIdentityName = identity.customDisplayName || identity.providerDisplayName;
            context.authIdentityId = identity.id;
            tl.debug(tl.loc('Debug_AuthenticatedIdentity', context.authIdentityName, context.authIdentityId));
        }
    } catch (error) {
        tl.debug(tl.loc('Debug_FailedToGetIdentityInfo', error));
    }

    // Fallback for identity ID if ConnectionData didn't provide it
    context.authIdentityId ??= context.adoServiceConnection
        ? tl.getEndpointAuthorizationParameter(context.adoServiceConnection, 'serviceprincipalid', true)
        : context.buildServiceAccountId;
}

export async function trySetAuth(context: UniversalPackageContext): Promise<boolean> {
    try {
        await setServiceUris(context);

        if (!await trySetAccessToken(context)) {
            throw new Error(tl.loc('Error_NoAuthToken'));
        }

        await setIdentityInformation(context);

        const toolRunnerOptions = artifactToolRunner.getOptions();
        toolRunnerOptions.env.UNIVERSAL_AUTH_TOKEN = context.accessToken;
        context.toolRunnerOptions = toolRunnerOptions;
        return true;
    } catch (error) {
        await handleTaskError(error, tl.loc('Error_AuthenticationFailed'), context);
        return false;
    }
}

// =============================================================================
// Feed resolution
// =============================================================================

export function setFeed(context: UniversalPackageContext): void {
    tl.debug(tl.loc('Debug_ParsedFeedInfo', context.serviceUri, context.projectAndFeed));

    const feed = getProjectScopedFeed(context.projectAndFeed);
    context.feedName = feed.feedId;
    context.projectName = feed.projectId;

    if (context.projectName) {
        tl.debug(tl.loc('Debug_ProjectScopedFeed', context.projectName, context.feedName));
    } else {
        tl.debug(tl.loc('Debug_OrgScopedFeed', context.feedName));
    }
}

// =============================================================================
// Artifact tool
// =============================================================================

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
        await handleTaskError(error, errorMessage, context);
        return false;
    } finally {
        logArtifactToolTelemetry(context);
    }
}

// =============================================================================
// Error handling, telemetry, and logging
// =============================================================================

export async function handleTaskError(err: any, errorMessage: string, context?: UniversalPackageContext): Promise<void> {
    tl.error(err);

    if (context?.adoServiceConnection) {
        tl.warning(tl.loc("Warning_ServiceConnectionIdentityHint", context.adoServiceConnection, context.authIdentityName, context.authIdentityId));
    } else if (context) {
        tl.warning(tl.loc("Warning_BuildServiceIdentityHint", context.authIdentityName, context.authIdentityId));
    }

    tl.setResult(tl.TaskResult.Failed, errorMessage);
}

function logArtifactToolTelemetry(context: UniversalPackageContext): void {
    try {
        let artifactToolTelemetry = {
            "command": context.command,
            "organization": context.organization,
            "feed": context.projectAndFeed,
            "packageName": context.packageName,
            "packageVersion": context.packageVersion,
            "versionIncrement": context.versionIncrement,
            "adoServiceConnection": context.adoServiceConnection,
            "artifactToolPath": context.artifactToolPath,
            "pipelineCollectionUri": context.pipelineCollectionUri,
        };

        telemetry.emitTelemetry("Packaging", "UniversalPackagesV1", artifactToolTelemetry);
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

// Log an information-level message using a localized string.
// This provides always-visible output (unlike tl.debug which is suppressed unless System.Debug is set).
export function logInfo(key: string, ...params: any[]): void {
    console.log(tl.loc(key, ...params));
}

