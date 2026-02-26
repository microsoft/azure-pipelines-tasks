import * as common from "azure-pipelines-tasks-artifacts-common/serviceConnectionUtils";
import { getPackagingRouteUrl } from "azure-pipelines-tasks-artifacts-common/connectionDataUtils";
import { ProtocolType } from "azure-pipelines-tasks-artifacts-common/protocols";
import { getProjectScopedFeed } from "azure-pipelines-tasks-artifacts-common/stringUtils";
import * as tl from "azure-pipelines-task-lib/task";
#if WIF
import { getFederatedWorkloadIdentityCredentials, getFeedTenantId } from "azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils";
#endif

const PYPI_SIMPLE_API_LOCATION_ID: string = "93377A2C-F5FB-48B9-A8DC-7781441CABF1";
const PYPI_API_VERSION: string = "5.0";

#if WIF
// Fetch a federated token and return the authenticated feed URL.
export async function buildWifFeedUri(serviceConnectionName: string, feedUrl: string): Promise<string> {
    const feedTenant = await getFeedTenantId(feedUrl);
    const token = await getFederatedWorkloadIdentityCredentials(serviceConnectionName, feedTenant);
    if (!token) {
        throw new Error(tl.loc("FailedToGetServiceConnectionAuth", serviceConnectionName));
    }
    return addCredentialsToUri(serviceConnectionName, token, feedUrl);
}
#endif

// Build authenticated PyPI Simple API URLs for internal Azure Artifacts feeds.
export async function buildInternalFeedUris(feedList: string[], accessToken: string): Promise<string[]> {
    if (!feedList || feedList.length === 0) {
        return [];
    }
    tl.debug(tl.loc("Info_AddingInternalFeeds", feedList.length));
    const uris: string[] = [];
    for (const feedName of feedList) {
        const feed = getProjectScopedFeed(feedName);
        const feedUri = await getPackagingRouteUrl(
            ProtocolType.PyPi,
            PYPI_API_VERSION,
            PYPI_SIMPLE_API_LOCATION_ID,
            feed.feedId,
            feed.projectId
        );
        uris.push(addCredentialsToUri("build", accessToken, feedUri));
    }
    return uris;
}

export function buildExternalFeedUris(serviceConnections: common.ServiceConnection[]): string[] {
    return serviceConnections.map((serviceConnection) => getUriWithCredentials(serviceConnection));
}

export function setPipIndexVariables(endpoints: string[], onlyAddExtraIndex: boolean): void {
    let extraIndexEndpoints = endpoints;

    if (!onlyAddExtraIndex && endpoints.length > 0) {
        tl.setVariable("PIP_INDEX_URL", endpoints[0], false);
        extraIndexEndpoints = endpoints.slice(1);
    }

    if (extraIndexEndpoints.length > 0) {
        const extraIndexUrl = extraIndexEndpoints.join(" ");
        tl.setVariable("PIP_EXTRA_INDEX_URL", extraIndexUrl, false);

        const pipExtraIndexUrlValue = tl.getVariable("PIP_EXTRA_INDEX_URL");
        if (pipExtraIndexUrlValue.length < extraIndexUrl.length) {
            tl.warning(tl.loc("Warn_TooManyFeedEntries"));
        }
    }
}

export function getUriWithCredentials(serviceConnection: common.ServiceConnection): string {
    let username: string;
    let password: string;
    let endpointUrl: string;
    switch (serviceConnection.authType) {
        case (common.ServiceConnectionAuthType.UsernamePassword):
            const usernamePasswordAuthInfo = serviceConnection as common.UsernamePasswordServiceConnection;
            endpointUrl = serviceConnection.packageSource.uri;
            username = usernamePasswordAuthInfo.username;
            password = usernamePasswordAuthInfo.password;
            tl.debug(`Detected username/password credentials for '${endpointUrl}'`);
            break;
        case (common.ServiceConnectionAuthType.Token):
            const tokenAuthInfo = serviceConnection as common.TokenServiceConnection;
            endpointUrl = serviceConnection.packageSource.uri;
            username = "build";
            password = tokenAuthInfo.token;
            tl.debug(`Detected token credentials for '${serviceConnection.packageSource.uri}'`);
            break;
        case (common.ServiceConnectionAuthType.ApiKey):
        default:
            break;
    }
    return addCredentialsToUri(username, password, endpointUrl);
}

export function addCredentialsToUri(username: string, password: string, uri: string) {
    try {
        const parsedUrl = new URL(uri);
        parsedUrl.username = username;
        parsedUrl.password = password;
        return parsedUrl.href;
    } catch (error) {
        throw new Error(tl.loc("Error_FailedToParseFeedUrlAndAuth", error));
    }
}