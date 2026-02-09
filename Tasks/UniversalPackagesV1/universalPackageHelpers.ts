import * as tl from "azure-pipelines-task-lib";
import * as telemetry from "azure-pipelines-tasks-utility-common/telemetry";
import { getFederatedWorkloadIdentityCredentials } from "azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils";
import { retryOnException } from "azure-pipelines-tasks-artifacts-common/retryUtils";
import { getWebApiWithProxy } from "azure-pipelines-tasks-artifacts-common/webapi";
import * as clientToolUtils from "azure-pipelines-tasks-packaging-common/universal/ClientToolUtilities";
import * as artifactToolUtilities from "azure-pipelines-tasks-packaging-common/universal/ArtifactToolUtilities";
import * as artifactToolRunner from "azure-pipelines-tasks-packaging-common/universal/ArtifactToolRunner";
import { UniversalPackageContext, OperationType } from "./UniversalPackageContext";

// Re-export for use by download/publish modules
export { artifactToolRunner };

// Get system access token from SYSTEMVSSCONNECTION endpoint
function getSystemAccessToken(): string | undefined {
    const auth = tl.getEndpointAuthorization('SYSTEMVSSCONNECTION', false);
    return auth?.parameters?.['AccessToken'];
}

// Try to get system access token and set it on context
function tryGetSystemAccessToken(context: UniversalPackageContext): boolean {
    tl.debug(tl.loc('Debug_UsingBuildServiceCreds'));
    context.accessToken = getSystemAccessToken();
    return !!context.accessToken;
}

// Discover the tenant ID for the target feed by making a HEAD request
// The X-VSS-ResourceTenant header is only returned on HEAD requests, not GET
async function getFeedTenantId(feedUrl: string): Promise<string | undefined> {
    try {
        const response = await fetch(feedUrl, { method: 'HEAD' });
        return response?.headers?.get('X-VSS-ResourceTenant') ?? undefined;
    } catch (error) {
        tl.debug(tl.loc('Debug_FailedToGetFeedTenantId', feedUrl, error));
        return undefined;
    }
}

function setUris(context: UniversalPackageContext): void {
    if (context.adoServiceConnection) {
        if (!context.organization) {
            throw new Error(tl.loc('Error_OrganizationRequired'));
        }
        context.serviceUri = `https://dev.azure.com/${encodeURIComponent(context.organization)}`;
    } else {
        context.serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
    }
    context.feedServiceUri = context.serviceUri.replace('://dev.azure.com/', '://feeds.dev.azure.com/');
    tl.debug(tl.loc('Debug_UsingServiceUri', context.serviceUri));
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

async function setIdentityInformation(context: UniversalPackageContext): Promise<void> {
    try {
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
        setUris(context);

        if (!await trySetAccessToken(context)) {
            throw new Error(tl.loc('Error_NoAuthToken'));
        }

        // Create and cache the location API client
        tl.debug(tl.loc('Debug_CreatingLocationApi'));
        const webApi = getWebApiWithProxy(context.serviceUri, context.accessToken);
        context.locationApi = await webApi.getLocationsApi();

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
        await handleTaskError(error, errorMessage, context);
        return false;
    } finally {
        logArtifactToolTelemetry(context);
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
        await handleTaskError(error, tl.loc("Error_UniversalPackagesNotSupportedOnPrem"), undefined);
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

// Log an information-level message using a localized string
// This provides always-visible output (unlike tl.debug which is suppressed unless System.Debug is set)
export function logInfo(key: string, ...params: any[]): void {
    console.log(tl.loc(key, ...params));
}

// Derive SPS base URL from a service URI (handles different Azure clouds)
function getSpsBaseUrl(serviceUri: string): string {
    const uri = serviceUri.toLowerCase();
    if (uri.includes('.cn')) return 'https://app.vssps.visualstudio.cn';
    if (uri.includes('.us')) return 'https://app.vssps.visualstudio.us';
    if (uri.includes('.de')) return 'https://app.vssps.visualstudio.de';
    return 'https://app.vssps.visualstudio.com';
}

// Core resource area ID for organization discovery
const CORE_RESOURCE_AREA_ID = '79134c72-4a58-4b42-976c-04e7115f32bf';

// DEBUG: Temporary function to test organization discovery APIs
// This function explores using the SPS resource areas API to resolve org names to URLs
export async function debugOrganizationDiscovery(context: UniversalPackageContext): Promise<void> {
    tl.debug('=== DEBUG: Organization Discovery ===');
    
    // Determine which scenario we're in
    const hasServiceConnection = !!context.adoServiceConnection;
    const hasOrgInput = !!context.organization;
    tl.debug(`adoServiceConnection provided: ${hasServiceConnection}`);
    tl.debug(`organization input provided: ${hasOrgInput}`);
    
    // Identify scenario
    let scenario: string;
    if (!hasServiceConnection && !hasOrgInput) {
        scenario = '1: No serviceConnection, No org → Use pipeline URI & token';
    } else if (!hasServiceConnection && hasOrgInput) {
        scenario = '2: No serviceConnection, Yes org → Compare org, fail if different';
    } else if (hasServiceConnection && !hasOrgInput) {
        scenario = '3: Yes serviceConnection, No org → Use pipeline URI + SC token (same-org, different identity)';
    } else {
        scenario = '4: Yes serviceConnection, Yes org → Cross-org with SC token';
    }
    tl.debug(`SCENARIO: ${scenario}`);
    
    // Get pipeline's local credentials and URI
    const localToken = getSystemAccessToken();
    const localServiceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
    const pipelineCollectionId = tl.getVariable("System.CollectionId");
    tl.debug(`Pipeline service URI: ${localServiceUri}`);
    tl.debug(`Pipeline Collection ID: ${pipelineCollectionId}`);
    
    // Derive SPS URL from pipeline's service URI
    const spsBaseUrl = getSpsBaseUrl(localServiceUri);
    tl.debug(`Derived SPS base URL: ${spsBaseUrl}`);
    
    // Get pipeline's organization name via CoreApi
    let pipelineOrgName: string | undefined;
    try {
        const webApi = getWebApiWithProxy(localServiceUri, localToken);
        const coreApi = await webApi.getCoreApi();
        const collection = await coreApi.getProjectCollection(pipelineCollectionId);
        pipelineOrgName = collection.name;
        tl.debug(`Pipeline organization name (from CoreApi): "${pipelineOrgName}"`);
    } catch (error) {
        tl.debug(`ERROR getting pipeline org name: ${error}`);
    }
    
    // Get feed URI via location service (not string manipulation)
    let localFeedUri: string | undefined;
    try {
        const { getFeedUriFromBaseServiceUri } = await import("azure-pipelines-tasks-packaging-common/locationUtilities");
        localFeedUri = await getFeedUriFromBaseServiceUri(localServiceUri, localToken);
        tl.debug(`Pipeline feed URI (from location service): ${localFeedUri}`);
    } catch (error) {
        tl.debug(`ERROR getting feed URI from location service: ${error}`);
    }
    
    // Test the SPS discovery API to resolve org name to URL
    tl.debug('');
    tl.debug('--- Testing SPS Organization Discovery API ---');
    if (context.organization) {
        // Try with NO auth first (SPS might be a public directory)
        tl.debug(`Attempting to resolve org "${context.organization}" via SPS at ${spsBaseUrl} with NO auth...`);
        try {
            const spsUrl = `${spsBaseUrl}/_apis/resourceAreas/${CORE_RESOURCE_AREA_ID}?organizationName=${encodeURIComponent(context.organization)}&api-version=5.0-preview.1`;
            tl.debug(`  Calling: ${spsUrl}`);
            const response = await fetch(spsUrl);
            tl.debug(`  Response status: ${response.status}`);
            if (response.ok) {
                const data = await response.json();
                tl.debug(`SUCCESS with NO auth! Resource area response:`);
                tl.debug(`  id: ${data?.id}`);
                tl.debug(`  name: ${data?.name}`);
                tl.debug(`  locationUrl: ${data?.locationUrl}`);
            } else {
                tl.debug(`  Response not OK: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            tl.debug(`ERROR with NO auth: ${error}`);
        }
        
        // Try with pipeline token
        tl.debug(`Attempting to resolve org "${context.organization}" via SPS at ${spsBaseUrl} using PIPELINE token...`);
        try {
            const spsWebApi = getWebApiWithProxy(spsBaseUrl, localToken);
            const spsLocationApi = await spsWebApi.getLocationsApi();
            const resourceArea = await spsLocationApi.getResourceArea(CORE_RESOURCE_AREA_ID, undefined, context.organization);
            tl.debug(`SUCCESS with pipeline token! Resource area response:`);
            tl.debug(`  id: ${resourceArea?.id}`);
            tl.debug(`  name: ${resourceArea?.name}`);
            tl.debug(`  locationUrl: ${resourceArea?.locationUrl}`);
        } catch (error) {
            tl.debug(`ERROR with pipeline token: ${error}`);
        }
        
        // Try with WIF token (if available)
        if (context.accessToken) {
            tl.debug(`Attempting to resolve org "${context.organization}" via SPS at ${spsBaseUrl} using WIF token...`);
            try {
                const spsWebApiWif = getWebApiWithProxy(spsBaseUrl, context.accessToken);
                const spsLocationApiWif = await spsWebApiWif.getLocationsApi();
                const resourceAreaWif = await spsLocationApiWif.getResourceArea(CORE_RESOURCE_AREA_ID, undefined, context.organization);
                tl.debug(`SUCCESS with WIF token! Resource area response:`);
                tl.debug(`  id: ${resourceAreaWif?.id}`);
                tl.debug(`  name: ${resourceAreaWif?.name}`);
                tl.debug(`  locationUrl: ${resourceAreaWif?.locationUrl}`);
                
                // Compare to what we currently construct
                const currentlyConstructed = `https://dev.azure.com/${encodeURIComponent(context.organization)}`;
                tl.debug(`  Currently constructed URL: ${currentlyConstructed}`);
                tl.debug(`  URLs match? ${resourceAreaWif?.locationUrl === currentlyConstructed}`);
            } catch (error) {
                tl.debug(`ERROR with WIF token: ${error}`);
            }
        } else {
            tl.debug('No WIF token available, skipping WIF token SPS test');
        }
    } else {
        tl.debug('No organization input provided, skipping SPS discovery test');
    }
    
    // Now apply scenario-specific logic
    tl.debug('');
    tl.debug('--- Scenario-specific evaluation ---');
    
    if (!hasServiceConnection && !hasOrgInput) {
        // Scenario 1: Default same-org behavior
        tl.debug('Scenario 1: Use pipeline credentials');
        tl.debug(`  serviceUri should be: ${localServiceUri}`);
        tl.debug(`  feedServiceUri should be: ${localFeedUri}`);
        tl.debug(`  token: pipeline system token`);
        
    } else if (!hasServiceConnection && hasOrgInput) {
        // Scenario 2: Compare org input to pipeline org
        tl.debug('Scenario 2: Compare organization input to pipeline org');
        tl.debug(`  User org input: "${context.organization}"`);
        tl.debug(`  Pipeline org: "${pipelineOrgName}"`);
        const isSameOrg = pipelineOrgName?.toLowerCase() === context.organization?.toLowerCase();
        tl.debug(`  Same organization? ${isSameOrg}`);
        if (isSameOrg) {
            tl.debug(`  RESULT: Same org - proceed with pipeline URI`);
            tl.debug(`  serviceUri should be: ${localServiceUri}`);
            tl.debug(`  feedServiceUri should be: ${localFeedUri}`);
        } else {
            tl.debug(`  RESULT: Different org - SHOULD FAIL with "need adoServiceConnection" error`);
        }
        
    } else if (hasServiceConnection && !hasOrgInput) {
        // Scenario 3: Same-org with different identity
        tl.debug('Scenario 3: Same-org with service connection identity');
        tl.debug(`  serviceUri should be: ${localServiceUri}`);
        tl.debug(`  feedServiceUri should be: ${localFeedUri}`);
        tl.debug(`  token: from adoServiceConnection "${context.adoServiceConnection}"`);
        tl.debug(`  Current context.serviceUri: ${context.serviceUri}`);
        tl.debug(`  Current context.feedServiceUri: ${context.feedServiceUri}`);
        
    } else {
        // Scenario 4: Cross-org - try to use location API on target org
        tl.debug('Scenario 4: Cross-org with service connection');
        tl.debug(`  Target org input: "${context.organization}"`);
        tl.debug(`  Current context.serviceUri: ${context.serviceUri}`);
        tl.debug(`  Current context.feedServiceUri: ${context.feedServiceUri}`);
        tl.debug(`  Current context.accessToken available: ${!!context.accessToken}`);
        
        // Try to resolve feed URI from target org using location API
        tl.debug('');
        tl.debug('  Attempting to resolve feed URI from TARGET org via location API...');
        try {
            const { getFeedUriFromBaseServiceUri } = await import("azure-pipelines-tasks-packaging-common/locationUtilities");
            // Use the context's serviceUri (target org) and accessToken (from service connection)
            const targetFeedUri = await getFeedUriFromBaseServiceUri(context.serviceUri, context.accessToken);
            tl.debug(`  Target feed URI (from location service): ${targetFeedUri}`);
            tl.debug(`  Current context.feedServiceUri (string replace): ${context.feedServiceUri}`);
            tl.debug(`  URIs match? ${targetFeedUri === context.feedServiceUri}`);
        } catch (error) {
            tl.debug(`  ERROR getting target feed URI from location service: ${error}`);
        }
    }
    
    tl.debug('=== END DEBUG: Organization Discovery ===');
    tl.debug('');
}