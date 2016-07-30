import Q = require('q');
import * as locationApi from './LocationApi';
import * as vstsWebApi from 'vso-node-api/WebApi';
import * as util from 'util';
import * as tl from 'vsts-task-lib/task';
import * as path from 'path';
import * as url from 'url';

function getUriForAccessMapping(mapping: locationApi.AccessMapping): string {
    let accessPoint = mapping.accessPoint;
    if (!accessPoint.endsWith("/")) {
        accessPoint = accessPoint + "/";
    }

    let virtualDirectory = mapping.virtualDirectory;
    if (!virtualDirectory) {
        virtualDirectory = "";
    }

    return accessPoint + virtualDirectory;
}

function getConnectionData(uri: string, accessToken: string): Q.Promise<locationApi.ConnectionData> {
    return new locationApi.QLocationApi(uri, [vstsWebApi.getBearerHandler(accessToken)]).getConnectionData();
}

function getUriForServiceDefinition(serviceDefinition: locationApi.ServiceDefinition): string {
    if (serviceDefinition.relativeToSetting.toUpperCase() !== "FULLYQUALIFIED") {
        throw new Error("unexpected not-fully-qualified service definition");
    }

    var locationMappings = serviceDefinition.locationMappings;
    var hostGuidAccessMapping = locationMappings.find(mapping => mapping.accessMappingMoniker.toUpperCase() == "HOSTGUIDACCESSMAPPING")
    if (hostGuidAccessMapping) {
        return hostGuidAccessMapping.location;
    }

    var serverAccessMapping = locationMappings.find(mapping => mapping.accessMappingMoniker.toUpperCase() == "SERVERACCESSMAPPING")
    if (serverAccessMapping) {
        return serverAccessMapping.location;
    }

    var publicAccessMapping = locationMappings.find(mapping => mapping.accessMappingMoniker.toUpperCase() == "PUBLICACCESSMAPPING")
    if (serverAccessMapping) {
        return publicAccessMapping.location;
    }

    return null;
}


function findServiceByIdentifier(connectionData: locationApi.ConnectionData, serviceId: string): locationApi.ServiceDefinition {
    var serviceIdUppercase = serviceId.toUpperCase();
    var serviceDefinitions = connectionData.locationServiceData.serviceDefinitions;
    return serviceDefinitions.find(service => service.identifier.toUpperCase() == serviceIdUppercase);
}

function hasServicesOfType(connectionData: locationApi.ConnectionData, serviceType: string): boolean {
    var serviceTypeUpppercase = serviceType.toUpperCase();
    var serviceDefinitions = connectionData.locationServiceData.serviceDefinitions;
    return serviceDefinitions.some(service => service.serviceType.toUpperCase() == serviceTypeUpppercase);
}

export function getIdentityDisplayName(identity: locationApi.Identity): string {
    if (identity.customDisplayName) {
        return identity.customDisplayName;
    }
    if (identity.providerDisplayName) {
        return identity.providerDisplayName;
    }

    return null;
}

export function getIdentityAccount(identity: locationApi.Identity): string {
    if (identity.properties['Account']) {
        return identity.properties['Account'].$value
    }

    return null;
}

export function getAllAccessMappingUris(connectionData: locationApi.ConnectionData): string[] {
    var accessMappings = connectionData.locationServiceData.accessMappings;
    return accessMappings.map(getUriForAccessMapping);
}

export class GetConnectionDataForAreaError extends Error {
    constructor(message: string, public code: string) {
        super(message);
    } 
}

export function getConnectionDataForArea(serviceUri: string, areaName: string, areaId: string, accessToken: string): Q.Promise<locationApi.ConnectionData> {
    return getConnectionData(serviceUri, accessToken)
        .then(connectionData => {
            tl.debug("successfully loaded origin service location data");
            if (hasServicesOfType(connectionData, areaName)) {
                tl.debug(util.format("found %s routes on %s", areaName, serviceUri));
                return Q(connectionData);
            }
            else {
                tl.debug(util.format("did not find %s routes directly on %s, trying SPS", areaName, serviceUri));
                const rootLocationServiceId = "951917AC-A960-4999-8464-E3F0AA25B381";
                var sps = findServiceByIdentifier(connectionData, rootLocationServiceId);
                if (!sps) {
                    throw new GetConnectionDataForAreaError(
                        tl.loc("NGCommon_SpsNotFound", areaName, areaId),
                        "SpsNotFound");
                }

                var spsUri = getUriForServiceDefinition(sps);
                tl.debug(util.format("found SPS at %s", spsUri));

                return getConnectionData(spsUri, accessToken)
                    .then(spsConnectionData => {
                        tl.debug("successfully loaded SPS location data");
                        var areaService = findServiceByIdentifier(spsConnectionData, areaId);
                        if (!areaService) {
                            throw new GetConnectionDataForAreaError(
                                tl.loc("NGCommon_AreaNotFoundInSps", areaName, areaId),
                                "AreaNotFoundInSps");
                        }

                        var areaServiceUri = getUriForServiceDefinition(areaService)
                        tl.debug(util.format("found %s service in SPS at %s", areaId, areaServiceUri))
                        return getConnectionData(areaServiceUri, accessToken)
                            .then(connectionData => {
                                tl.debug("successfully loaded target service location data");
                                return connectionData;
                            });
                    });
            }
        });
}

export function getNuGetConnectionData(serviceUri: string, accessToken: string): Q.Promise<locationApi.ConnectionData> {
    return getConnectionDataForArea(serviceUri, 'nuget', 'b3be7473-68ea-4a81-bfc7-9530baaa19ad', accessToken);
}

/** 
 * Make assumptions about VSTS domain names to generate URI prefixes for feeds in the current collection.
 * Returns a promise so as to provide a drop-in replacement for location-service-based lookup.
 */
export function assumeNuGetUriPrefixes(collectionUri: string): Q.Promise<string[]> {
    let prefixes = [collectionUri];

    let collectionUrlObject = url.parse(collectionUri);
    if(collectionUrlObject.hostname.toUpperCase().endsWith(".VISUALSTUDIO.COM"))
    {
        let hostparts = collectionUrlObject.hostname.split('.');
        let packagingHostName = hostparts[0] + ".pkgs.visualstudio.com"
        collectionUrlObject.hostname = packagingHostName;
        // remove the host property so it doesn't override the hostname property for url.format
        delete collectionUrlObject.host;
        prefixes.push(url.format(collectionUrlObject));
    }

    return Q(prefixes);
}