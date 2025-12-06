import * as tl from "azure-pipelines-task-lib";
import * as telemetry from "azure-pipelines-tasks-utility-common/telemetry";
import { getSystemAccessToken } from "azure-pipelines-tasks-artifacts-common/webapi";
import { getFederatedWorkloadIdentityCredentials } from "azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils";
import { getConnectionDataForProtocol } from "azure-pipelines-tasks-artifacts-common/connectionDataUtils";
import { retryOnException } from "azure-pipelines-tasks-artifacts-common/retryUtils";
import { ProtocolType } from "azure-pipelines-tasks-artifacts-common/protocols";
import { ConnectionData } from "azure-devops-node-api/interfaces/LocationsInterfaces";
import * as clientToolUtils from "azure-pipelines-tasks-packaging-common/universal/ClientToolUtilities";
import * as artifactToolUtilities from "azure-pipelines-tasks-packaging-common/universal/ArtifactToolUtilities";
import { logError } from 'azure-pipelines-tasks-packaging-common/util';
import * as artifactToolRunner from "azure-pipelines-tasks-packaging-common/universal/ArtifactToolRunner";
import { IExecOptions } from "azure-pipelines-task-lib/toolrunner";

export interface UniversalPackageInputs {
    organization: string;
    feed: string;
    packageName: string;
    packageVersion: string;
    adoServiceConnection: string | undefined;
    directory: string;
}

export enum OperationType {
    Download = "download",
    Publish = "publish"
}

export interface FeedInfo {
    feedName: string;
    projectName: string | null;
    organizationName: string;
    serviceUri: string;
}

export interface AuthenticationInfo {
    accessToken: string;
    toolRunnerOptions: IExecOptions;
}

export function getUniversalPackageInputs(): UniversalPackageInputs {
    return {
        organization: tl.getInput("organization", true),
        feed: tl.getInput("feed", true),
        packageName: tl.getInput("packageName", true),
        packageVersion: tl.getInput("packageVersion", true),
        adoServiceConnection: tl.getInput("adoServiceConnection", false),
        directory: tl.getInput("directory", true)
    };
}

export function parseFeedInfo(organization: string, feed: string): FeedInfo {
    const serviceUri = `https://dev.azure.com/${organization}`;
    tl.debug(tl.loc('Debug_ParsedFeedInfo', serviceUri, feed));
    
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
        projectName,
        organizationName: organization,
        serviceUri
    };
}

export async function setupAuthentication(adoServiceConnection: string | undefined): Promise<AuthenticationInfo> {
    let accessToken: string | undefined;
    const toolRunnerOptions = artifactToolRunner.getOptions();
    
    if (adoServiceConnection) {
        tl.debug(tl.loc('Debug_UsingWifAuth', adoServiceConnection));
        try {
            accessToken = await getFederatedWorkloadIdentityCredentials(adoServiceConnection);
            if (accessToken) {
                tl.debug(tl.loc('Debug_WifTokenObtained'));
            } else {
                tl.warning(tl.loc('Warning_WifAuthNoToken', adoServiceConnection));
            }
        } catch (err) {
            tl.warning(tl.loc('Warning_WifAuthFailed', adoServiceConnection, err));
        }
    }
    
    accessToken ??= getSystemAccessToken();
    
    if (!accessToken) {
        throw new Error(tl.loc('Error_NoAuthToken'));
    }
    
    tl.debug(tl.loc('Debug_UsingBuildServiceCreds'));
    
    toolRunnerOptions.env.UNIVERSAL_AUTH_TOKEN = accessToken;

    return {
        accessToken,
        toolRunnerOptions
    };
}

export function handleTaskError(err: any, errorMessage: string, feedInfo?: FeedInfo): void {
    tl.error(err);

    const buildIdentityDisplayName = tl.getVariable('Build.RequestedFor') || 
                                    tl.getVariable('Release.RequestedFor') ||
                                    tl.getVariable('Agent.Name') || 
                                    '[Build Service Account]';
    const buildIdentityAccount = tl.getVariable('Build.RequestedForId') || '[Build Service]';
    
    tl.warning(tl.loc("Warning_BuildIdentityOperationHint", buildIdentityDisplayName, buildIdentityAccount));
    
    if (feedInfo) {
        const feedUrl = constructFeedPermissionsUrl(feedInfo);
        tl.warning(tl.loc("Warning_BuildIdentityFeedHint", feedInfo.feedName, feedUrl));
    }

    tl.setResult(tl.TaskResult.Failed, errorMessage);
}

function constructFeedPermissionsUrl(feedInfo: FeedInfo): string {
    const baseUrl = `https://dev.azure.com/${feedInfo.organizationName}`;
    if (feedInfo.projectName) {
        return `${baseUrl}/${feedInfo.projectName}/_artifacts/feed/${feedInfo.feedName}/settings/permissions`;
    } else {
        return `${baseUrl}/_artifacts/feed/${feedInfo.feedName}/settings/permissions`;
    }
}

export async function downloadArtifactTool(): Promise<string> {
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
    return artifactToolPath;
}

export async function getPackagingLocation(fallbackServiceUri: string): Promise<string> {
    let packagingLocation: string | undefined;
    let connectionData: ConnectionData | undefined;
    
    try {
        tl.debug(tl.loc('Debug_AcquiringConnectionData'));
        connectionData = await getConnectionDataForProtocol(ProtocolType.NuGet);
        tl.debug(tl.loc('Debug_ConnectionDataAcquired'));
    } catch (error) {
        tl.debug(tl.loc('Debug_ConnectionDataFailed'));
        logError(error);
    }
    
    packagingLocation ??= getDefaultAccessPoint(connectionData) || fallbackServiceUri;
    tl.debug(tl.loc('Debug_UsingPackagingLocation', packagingLocation));
    
    if (packagingLocation !== fallbackServiceUri) {
        tl.debug(tl.loc('Debug_UsingOptimizedEndpoint'));
    } else {
        tl.debug(tl.loc('Debug_UsingFallbackUri'));
    }
    
    return packagingLocation;
}

function getDefaultAccessPoint(connectionData: ConnectionData | undefined): string | undefined {
    if (!connectionData?.locationServiceData?.accessMappings || !connectionData.locationServiceData.defaultAccessMappingMoniker) {
        return undefined;
    }

    const defaultMapping = connectionData.locationServiceData.accessMappings.find((mapping: any) =>
        mapping.moniker === connectionData.locationServiceData.defaultAccessMappingMoniker
    );

    return defaultMapping?.accessPoint;
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

export { artifactToolRunner };