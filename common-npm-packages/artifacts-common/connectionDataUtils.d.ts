import * as protocols from './protocols';
import { ConnectionData } from 'azure-devops-node-api/interfaces/LocationsInterfaces';
/**
 * Gets the raw connection data (direct representation of _apis/connectionData) for the service hosting a particular protocol
 * @param protocolType The packaging protocol, e.g. 'NuGet'
 */
export declare function getConnectionDataForProtocol(protocolType: protocols.ProtocolType): Promise<ConnectionData>;
/**
 * Gets the api location url for any feed given the location id. This method won't work for routes that have paramerters other than feedId and projectId.
 * @param protocolType Packaging protoocol like "NuGet", "PyPI"
 * @param apiVersion Api version of the endpoint. ex: 3.0-preview, 5.0
 * @param locationGuid location id for an api. ex: 93377A2C-F5FB-48B9-A8DC-7781441CABF1 for PyPi simple api
 * @param feedId FeedId to put in api params
 * @param project projectId to put in api params
 */
export declare function getPackagingRouteUrl(protocolType: protocols.ProtocolType, apiVersion: string, locationGuid: string, feedId: string, project: string): Promise<string>;
