import * as tl from 'azure-pipelines-task-lib/task';
import * as protocols from './protocols';
import * as api from './webapi';
import { retryOnException } from './retryUtils';
import { ConnectOptions } from 'azure-devops-node-api/interfaces/common/VSSInterfaces';
import { ConnectionData } from 'azure-devops-node-api/interfaces/LocationsInterfaces';

/**
 * Gets the raw connection data (direct representation of _apis/connectionData) for the service hosting a particular protocol
 * @param protocolType The packaging protocol, e.g. 'NuGet'
 */
export async function getConnectionDataForProtocol(protocolType: protocols.ProtocolType) : Promise<ConnectionData> {
    // Retry getting the connection data (which also potentially includes a network call to find the packaging service first),
    // since we've previously had reliability issues here.
    return await retryOnException(async () => {
        // Determine where the Packaging service lives
        tl.debug('Finding the URI for the packaging service');
        const accessToken = api.getSystemAccessToken();
        const areaId = protocols.getAreaIdForProtocol(protocolType);
        const serviceUri = await getServiceUriFromAreaId(areaId, accessToken);

        // Get _apis/connectionData from the packaging service
        const webApi = api.getWebApiWithProxy(serviceUri, accessToken);
        const locationApi = await webApi.getLocationsApi();
        tl.debug(`Acquiring connection data for: ${serviceUri}`);
        const connectionData = await locationApi.getConnectionData(ConnectOptions.IncludeServices);
        tl.debug('Successfully acquired the connection data');
        return connectionData;
    }, 3, 1000);
}

/**
 * Gets the api location url for any feed given the location id. This method won't work for routes that have paramerters other than feedId and projectId.
 * @param protocolType Packaging protoocol like "NuGet", "PyPI"
 * @param apiVersion Api version of the endpoint. ex: 3.0-preview, 5.0
 * @param locationGuid location id for an api. ex: 93377A2C-F5FB-48B9-A8DC-7781441CABF1 for PyPi simple api
 * @param feedId FeedId to put in api params
 * @param project projectId to put in api params
 */
export async function getPackagingRouteUrl(
    protocolType: protocols.ProtocolType,
    apiVersion: string,
    locationGuid: string,
    feedId: string,
    project: string): Promise<string> {

    tl.debug('Finding route for location ' + locationGuid);
    return await retryOnException(async () => {
        const accessToken = api.getSystemAccessToken();
        const areaId = protocols.getAreaIdForProtocol(protocolType);
        const serviceUri = await getServiceUriFromAreaId(areaId, accessToken);

        const webApi = api.getWebApiWithProxy(serviceUri, accessToken);
        const data = await webApi.vsoClient.getVersioningData(apiVersion, protocols.ProtocolType[protocolType], locationGuid, { feedId: feedId, project: project });

        tl.debug('Resolved Route: ' + data.requestUrl);
        return data.requestUrl;
    }, 3, 1000);
}

/**
 * Gets the URI of the service that hosts an area.
 */
async function getServiceUriFromAreaId(areaId: string, accessToken: string): Promise<string> {
    const tfsCollectionUrl = tl.getVariable('System.TeamFoundationCollectionUri');
    const serverType = tl.getVariable('System.ServerType');
    if (!serverType || serverType.toLowerCase() !== 'hosted') {
        tl.debug(`Using '${tfsCollectionUrl}' as the service URI since this is on-premises`);
        return tfsCollectionUrl;
    }

    const webApi = api.getWebApiWithProxy(tfsCollectionUrl, accessToken);
    const locationApi = await webApi.getLocationsApi();

    tl.debug(`Getting URI for area ID ${areaId} from ${tfsCollectionUrl}`);
    try {
        const serviceUriFromArea = await locationApi.getResourceArea(areaId);
        tl.debug(`Acquired the resource area: ${JSON.stringify(serviceUriFromArea)}`);
        return serviceUriFromArea.locationUrl;
    } catch (error) {
        tl.debug(`Failed to obtain the service URI for area ID ${areaId}`);
        if (error instanceof Error) {
            if (error.message) { tl.debug(error.message); }
            if (error.stack) { tl.debug(error.stack); }
        } else {
            tl.debug(error);
        }
        throw error;
    }
}