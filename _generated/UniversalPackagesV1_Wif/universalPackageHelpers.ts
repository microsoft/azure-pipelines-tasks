import * as tl from "azure-pipelines-task-lib";
import * as telemetry from "azure-pipelines-tasks-utility-common/telemetry";
import { getFederatedWorkloadIdentityCredentialsForFeed } from "azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils";
import { getProjectScopedFeed } from "azure-pipelines-tasks-artifacts-common/stringUtils";
import { getWebApiWithProxy, requireHttpsUrl } from "azure-pipelines-tasks-artifacts-common/webapi";
import { getAreaIdForProtocol, ProtocolType } from "azure-pipelines-tasks-artifacts-common/protocols";
import * as artifactToolRunner from "azure-pipelines-tasks-packaging-common/universal/ArtifactToolRunner";
import { UniversalPackageContext, OperationType } from "./UniversalPackageContext";

export { artifactToolRunner };

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
        if (!context.packageVersion) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("Error_PackageVersionRequired"));
            return false;
        }
    } else if (context.command === OperationType.Publish) {
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

export function getSystemAccessToken(): string | undefined {
    const auth = tl.getEndpointAuthorization('SYSTEMVSSCONNECTION', false);
    return auth?.parameters?.['AccessToken'];
}

function tryGetSystemAccessToken(context: UniversalPackageContext): boolean {
    tl.debug(tl.loc('Debug_UsingBuildServiceCreds'));
    context.accessToken = getSystemAccessToken();
    return !!context.accessToken;
}

async function tryGetWifToken(context: UniversalPackageContext): Promise<boolean> {
    tl.debug(tl.loc('Debug_UsingWifAuth', context.adoServiceConnection));
    
    try {
        if (!context.feedUrl) {
            throw new Error(tl.loc('Error_FeedUrlRequired'));
        }
        const credentials = await getFederatedWorkloadIdentityCredentialsForFeed(
            context.adoServiceConnection,
            context.feedUrl,
            ProtocolType.Universal
        );
        if (credentials) {
            context.accessToken = credentials.accessToken;
            context.serviceUri = credentials.feedUrl.href;
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

function setSystemServiceUri(context: UniversalPackageContext): void {
    if (!context.adoServiceConnection) {
        context.serviceUri = tl.getEndpointUrlRequired("SYSTEMVSSCONNECTION");
        tl.debug(tl.loc('Debug_UsingServiceUri', context.serviceUri));
    }
}

async function setFeedServiceUri(context: UniversalPackageContext): Promise<void> {
    try {
        const rootServiceUrl = requireHttpsUrl(context.serviceUri).href;
        const webApi = getWebApiWithProxy(
            rootServiceUrl,
            context.accessToken,
            { maxRedirects: 0 });
        const locationApi = await webApi.getLocationsApi();
        const resourceArea = await locationApi.getResourceArea(
            getAreaIdForProtocol(ProtocolType.Universal));
        context.feedServiceUri =
            requireHttpsUrl(resourceArea.locationUrl).href;
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

    context.authIdentityId ??= context.adoServiceConnection
        ? tl.getEndpointAuthorizationParameter(context.adoServiceConnection, 'serviceprincipalid', true)
        : context.buildServiceAccountId;
}

export async function trySetAuth(context: UniversalPackageContext): Promise<boolean> {
    try {
        setSystemServiceUri(context);

        if (!await trySetAccessToken(context)) {
            throw new Error(tl.loc('Error_NoAuthToken'));
        }
        if (!context.serviceUri) {
            throw new Error(tl.loc('Error_FailedToResolveFeedUri', context.feedUrl));
        }

        await setFeedServiceUri(context);
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

export async function handleTaskError(err: any, errorMessage: string, context?: UniversalPackageContext): Promise<void> {
    tl.error(err);

    if (context?.adoServiceConnection) {
        tl.warning(tl.loc("Warning_ServiceConnectionIdentityHint", context.adoServiceConnection, context.authIdentityName, context.authIdentityId));
    } else if (context) {
        tl.warning(tl.loc("Warning_BuildServiceIdentityHint", context.authIdentityName, context.authIdentityId));
    }

    tl.setResult(tl.TaskResult.Failed, errorMessage);
}

export function logArtifactToolTelemetry(context: UniversalPackageContext): void {
    try {
        let artifactToolTelemetry = {
            "command": context.command,
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

export function logInfo(key: string, ...params: any[]): void {
    console.log(tl.loc(key, ...params));
}
