import * as vsts from 'vso-node-api';
import * as interfaces from 'vso-node-api/interfaces/common/VSSInterfaces';
import * as tl from 'vsts-task-lib/task';
import { IRequestOptions } from 'vso-node-api/interfaces/common/VsoBaseInterfaces';

export enum ProtocolType {
    NuGet,
    Maven,
    Npm
}

export interface PackagingLocation {
    PackagingUris: string[];
    DefaultPackagingUri: string;
}

// Getting service urls from resource areas api
export async function getServiceUriFromAreaId(serviceUri: string, accessToken: string, areaId: string): Promise<string> {
    const serverType = tl.getVariable('System.ServerType');
    if (!serverType || serverType.toLowerCase() !== 'hosted') {
        return serviceUri;
    }

    const webApi = getWebApiWithProxy(serviceUri, accessToken);
    const locationApi = await webApi.getLocationsApi();

    tl.debug(`Getting URI for area ID ${areaId} from ${serviceUri}`);
    const serviceUriFromArea = await locationApi.getResourceArea(areaId);

    return serviceUriFromArea.locationUrl;
}

export async function getNuGetUriFromBaseServiceUri(serviceUri: string, accesstoken: string): Promise<string> {
    const nugetAreaId = 'B3BE7473-68EA-4A81-BFC7-9530BAAA19AD';

    return getServiceUriFromAreaId(serviceUri, accesstoken, nugetAreaId);
}

// Feeds url from location service
export async function getFeedUriFromBaseServiceUri(serviceUri: string, accesstoken: string): Promise<string> {
    const feedAreaId = '7ab4e64e-c4d8-4f50-ae73-5ef2e21642a5';

    return getServiceUriFromAreaId(serviceUri, accesstoken, feedAreaId);
}

export async function getBlobstoreUriFromBaseServiceUri(serviceUri: string, accesstoken: string): Promise<string> {
    const blobAreaId = '5294ef93-12a1-4d13-8671-9d9d014072c8';

    return getServiceUriFromAreaId(serviceUri, accesstoken, blobAreaId);
}

/**
 * PackagingLocaiton.PackagingUris:
 *  The first URI will always be the TFS collection URI
 *  The second URI, if existent, will be Packaging's default access point
 *  The remaining URI's will be alternate Packaging's access points
 */
export async function getPackagingUris(protocolType: ProtocolType): Promise<PackagingLocation> {
    tl.debug('Getting Packaging service access points');
    const collectionUrl = tl.getVariable('System.TeamFoundationCollectionUri');

    const pkgLocation: PackagingLocation = {
        PackagingUris: [collectionUrl],
        DefaultPackagingUri: collectionUrl
    };

    const serverType = tl.getVariable('System.ServerType');
    if (!serverType || serverType.toLowerCase() !== 'hosted') {
        return pkgLocation;
    }

    const accessToken = getSystemAccessToken();
    const areaId = getAreaIdForProtocol(protocolType);

    const serviceUri = await getServiceUriFromAreaId(collectionUrl, accessToken, areaId);

    const webApi = getWebApiWithProxy(serviceUri);

    const locationApi = await webApi.getLocationsApi();

    tl.debug('Acquiring Packaging endpoints from ' + serviceUri);
    return locationApi.getConnectionData(interfaces.ConnectOptions.IncludeServices).then((connectionData) => {
        tl.debug('Successfully acquired the connection data');
        const defaultAccessPoint: string = connectionData.locationServiceData.accessMappings.find((mapping) =>
            mapping.moniker === connectionData.locationServiceData.defaultAccessMappingMoniker
        ).accessPoint;

        pkgLocation.DefaultPackagingUri = defaultAccessPoint;
        pkgLocation.PackagingUris.push(defaultAccessPoint);
        pkgLocation.PackagingUris = pkgLocation.PackagingUris.concat(
            connectionData.locationServiceData.accessMappings.map((mapping) => {
                return mapping.accessPoint;
            }));

        tl.debug('Acquired location');
        tl.debug(JSON.stringify(pkgLocation));
        return pkgLocation;
    }).catch((error) => {
        tl.debug('An error occurred while acquiring the connection data');
        tl.debug(JSON.stringify(error));
        return pkgLocation;
    });
}

export function getSystemAccessToken(): string {
    tl.debug('Getting credentials for local feeds');
    const auth = tl.getEndpointAuthorization('SYSTEMVSSCONNECTION', false);
    if (auth.scheme === 'OAuth') {
        tl.debug('Got auth token');
        return auth.parameters['AccessToken'];
    } else {
        tl.warning('Could not determine credentials to use for NuGet');
    }
}

function getAreaIdForProtocol(protocolType: ProtocolType): string {
    switch (protocolType) {
        case ProtocolType.Maven:
            return '6F7F8C07-FF36-473C-BCF3-BD6CC9B6C066';
        case ProtocolType.Npm:
            return '4C83CFC1-F33A-477E-A789-29D38FFCA52E';
        default:
        case ProtocolType.NuGet:
            return 'B3BE7473-68EA-4A81-BFC7-9530BAAA19AD';
    }
}

function getWebApiWithProxy(serviceUri: string, accessToken?: string): vsts.WebApi {
    if (!accessToken) {
        accessToken = getSystemAccessToken();
    }

    const credentialHandler = vsts.getBasicHandler('vsts', accessToken);
    const options: IRequestOptions = {
        proxy: tl.getHttpProxyConfiguration(serviceUri)
    };
    return new vsts.WebApi(serviceUri, credentialHandler, options);
}