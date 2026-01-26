import * as tl from "azure-pipelines-task-lib";
import * as telemetry from "azure-pipelines-tasks-utility-common/telemetry";
import { getFederatedWorkloadIdentityCredentials } from "azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils";
import { retryOnException } from "azure-pipelines-tasks-artifacts-common/retryUtils";
import * as clientToolUtils from "azure-pipelines-tasks-packaging-common/universal/ClientToolUtilities";
import * as artifactToolUtilities from "azure-pipelines-tasks-packaging-common/universal/ArtifactToolUtilities";
import * as artifactToolRunner from "azure-pipelines-tasks-packaging-common/universal/ArtifactToolRunner";
import { UniversalPackageContext, OperationType } from "./UniversalPackageContext";
import { getFeedDiagnostics } from "./feedSecurity";

// Re-export for use by download/publish modules
export { artifactToolRunner };

// Get system access token using the main task-lib version to avoid version mismatch issues
function getSystemAccessToken(): string {
    const auth = tl.getEndpointAuthorization('SYSTEMVSSCONNECTION', false);
    if (auth && auth.parameters) {
        return auth.parameters['AccessToken'];
    }
    return null;
}

export async function trySetAuth(context: UniversalPackageContext): Promise<boolean> {
    try {
        const toolRunnerOptions = artifactToolRunner.getOptions();
        let accessToken: string | undefined;

        if (context.adoServiceConnection) {
            tl.debug(tl.loc('Debug_UsingWifAuth', context.adoServiceConnection));
            try {
                // Verify service connection exists before attempting WIF auth
                const serviceConnectionAuth = tl.getEndpointAuthorization(context.adoServiceConnection, false);
                if (!serviceConnectionAuth) {
                    tl.warning(tl.loc('Warning_ServiceConnectionNotFound', context.adoServiceConnection));
                } else {
                    accessToken = await getFederatedWorkloadIdentityCredentials(context.adoServiceConnection);
                    if (accessToken) {
                        tl.debug(tl.loc('Debug_WifTokenObtained'));
                    } else {
                        tl.warning(tl.loc('Warning_WifAuthNoToken', context.adoServiceConnection));
                    }
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
        
        // This converts https://dev.azure.com/{org} to https://feeds.dev.azure.com/{org}
        context.feedServiceUri = serviceUri.replace('://dev.azure.com/', '://feeds.dev.azure.com/');
        
        context.toolRunnerOptions = toolRunnerOptions;
        return true;
    } catch (error) {
        await handleTaskError(error, tl.loc('Error_AuthenticationFailed'));
        return false;
    }
}

export function setFeed(context: UniversalPackageContext): void {
    tl.debug(tl.loc('Debug_ParsedFeedInfo', context.serviceUri, context.projectAndFeed));

    // Parse feed input to extract project and feed names
    let feedName: string;
    let projectName: string | null = null;
    
    if (context.projectAndFeed.includes('/')) {
        const feedParts = context.projectAndFeed.split('/');
        projectName = feedParts[0];
        feedName = feedParts[1];
        tl.debug(tl.loc('Debug_ProjectScopedFeed', projectName, feedName));
    } else {
        feedName = context.projectAndFeed;
        tl.debug(tl.loc('Debug_OrgScopedFeed', feedName));
    }

    context.feedName = feedName;
    context.projectName = projectName;
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
        await handleTaskError(error, errorMessage);
        return false;
    } finally {
        logArtifactToolTelemetry(context);
    }
}



export async function handleTaskError(err: any, errorMessage: string, context?: UniversalPackageContext): Promise<void> {
    tl.error(err);

    const buildIdentityDisplayName = tl.getVariable('Build.RequestedFor') || 
                                    tl.getVariable('Release.RequestedFor') ||
                                    tl.getVariable('Agent.Name') || 
                                    '[Build Service Account]';
    const buildIdentityAccount = tl.getVariable('Build.RequestedForId') || '[Build Service]';
    
    tl.warning(tl.loc("Warning_BuildIdentityOperationHint", buildIdentityDisplayName, buildIdentityAccount));
    
    // Get feed diagnostics to provide helpful error information
    if (context && context.feedName && context.feedServiceUri && context.accessToken) {
        const diagnostics = await getFeedDiagnostics(context);
        if (diagnostics) {
            tl.warning(diagnostics);
        }
        
        // Provide link to feed permissions page
        if (context.organization) {
            const feedUrl = constructFeedPermissionsUrl(context.organization, context.projectName, context.feedName);
            tl.warning(tl.loc("Warning_BuildIdentityFeedHint", context.feedName, feedUrl));
        }
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

export async function validateServerType(): Promise<boolean> {
    try {
        const serverType = tl.getVariable("System.ServerType");
        if (!serverType || serverType.toLowerCase() !== "hosted") {
            throw new Error(tl.loc("Error_UniversalPackagesNotSupportedOnPrem"));
        }
        return true;
    } catch (error) {
        await handleTaskError(error, tl.loc("Error_UniversalPackagesNotSupportedOnPrem"));
        return false;
    }
}

export function logArtifactToolTelemetry(context: UniversalPackageContext): void {
    try {
        let artifactToolTelemetry = {
            "command": context.command,
            "organization": context.organization,
            "feed": context.projectAndFeed,
            "packageName": context.packageName,
            "packageVersion": context.packageVersion,
            "versionIncrement": context.versionIncrement,
            "adoServiceConnection": context.adoServiceConnection,
            "verbosity": context.verbosity,
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