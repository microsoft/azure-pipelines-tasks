import * as Q from "q";
import * as url from "url";
import * as util from "util";
import * as vstsWebApi from "vso-node-api/WebApi";
import * as tl from "vsts-task-lib/task";

import * as auth from "./Authentication";
import * as locationApi from "./LocationApi";

export const NUGET_ORG_V2_URL: string = "https://www.nuget.org/api/v2/";
export const NUGET_ORG_V3_URL: string = "https://api.nuget.org/v3/index.json";

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

function getConnectionData(uri: string, username: string, password: string): Q.Promise<locationApi.ConnectionData> {
    const defer = Q.defer<locationApi.ConnectionData>();
    new locationApi.LocationApi(uri, [vstsWebApi.getBasicHandler(username, password)])
        .getConnectionData((err: any, statusCode: number, connectionData: locationApi.ConnectionData) => {
        if (err) {
            err.statusCode = statusCode;
            defer.reject(err);
        }
        else {
            defer.resolve(connectionData);
        }
    });
    return defer.promise;
}

function getUriForServiceDefinition(serviceDefinition: locationApi.ServiceDefinition): string {
    if (serviceDefinition.relativeToSetting.toUpperCase() !== "FULLYQUALIFIED") {
        throw new Error("unexpected not-fully-qualified service definition");
    }

    let locationMappings = serviceDefinition.locationMappings;
    let hostGuidAccessMapping
        = locationMappings.find(mapping => mapping.accessMappingMoniker.toUpperCase() === "HOSTGUIDACCESSMAPPING");
    if (hostGuidAccessMapping) {
        return hostGuidAccessMapping.location;
    }

    let serverAccessMapping
        = locationMappings.find(mapping => mapping.accessMappingMoniker.toUpperCase() === "SERVERACCESSMAPPING");
    if (serverAccessMapping) {
        return serverAccessMapping.location;
    }

    let publicAccessMapping
        = locationMappings.find(mapping => mapping.accessMappingMoniker.toUpperCase() === "PUBLICACCESSMAPPING");
    if (publicAccessMapping) {
        return publicAccessMapping.location;
    }

    return null;
}

function findServiceByIdentifier(
    connectionData: locationApi.ConnectionData,
    serviceId: string): locationApi.ServiceDefinition {

    let serviceIdUppercase = serviceId.toUpperCase();
    let serviceDefinitions = connectionData.locationServiceData.serviceDefinitions;
    return serviceDefinitions.find(service => service.identifier.toUpperCase() === serviceIdUppercase);
}

function hasServicesOfType(connectionData: locationApi.ConnectionData, serviceType: string): boolean {
    let serviceTypeUpppercase = serviceType.toUpperCase();
    let serviceDefinitions = connectionData.locationServiceData.serviceDefinitions;
    return serviceDefinitions.some(service => service.serviceType.toUpperCase() === serviceTypeUpppercase);
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
    if (identity.properties["Account"]) {
        return identity.properties["Account"].$value;
    }

    return null;
}

export function getAllAccessMappingUris(connectionData: locationApi.ConnectionData): string[] {
    let accessMappings = connectionData.locationServiceData.accessMappings;
    return accessMappings.map(getUriForAccessMapping);
}

export class GetConnectionDataForAreaError extends Error {
    constructor(message: string, public code: string) {
        super(message);
    }
}

export function getConnectionDataForArea(
    serviceUri: string,
    areaName: string,
    areaId: string,
    username: string,
    accessToken: string): Q.Promise<locationApi.ConnectionData> {
    return getConnectionData(serviceUri, username, accessToken)
        .then((connectionData) => {
            tl.debug("successfully loaded origin service location data");
            if (hasServicesOfType(connectionData, areaName)) {
                tl.debug(util.format("found %s routes on %s", areaName, serviceUri));
                return Q(connectionData);
            }
            else {
                tl.debug(util.format("did not find %s routes directly on %s, trying SPS", areaName, serviceUri));
                const rootLocationServiceId = "951917AC-A960-4999-8464-E3F0AA25B381";
                const sps = findServiceByIdentifier(connectionData, rootLocationServiceId);
                if (!sps) {
                    throw new GetConnectionDataForAreaError(
                        tl.loc("NGCommon_SpsNotFound", areaName, areaId),
                        "SpsNotFound");
                }

                const spsUri = getUriForServiceDefinition(sps);
                tl.debug(util.format("found SPS at %s", spsUri));

                return getConnectionData(spsUri, username, accessToken)
                    .then((spsConnectionData) => {
                        tl.debug("successfully loaded SPS location data");
                        const areaService = findServiceByIdentifier(spsConnectionData, areaId);
                        // If no areaService it's quite probably the service containing the area has not been
                        // faulted in
                        if (!areaService) {
                            tl.debug(tl.loc("NGCommon_AreaNotFoundInSps", areaName, areaId));
                            return null;
                        }

                        const areaServiceUri = getUriForServiceDefinition(areaService);
                        tl.debug(util.format("found %s service in SPS at %s", areaId, areaServiceUri));
                        return getConnectionData(areaServiceUri, username, accessToken)
                            .then((targetConnectionData) => {
                                tl.debug("successfully loaded target service location data");
                                return targetConnectionData;
                            });
                    });
            }
        });
}

export function getNuGetConnectionData(serviceUri: string, accessToken: string): Q.Promise<locationApi.ConnectionData> {
    return getConnectionDataForArea(
        serviceUri,
        "nuget",
        "b3be7473-68ea-4a81-bfc7-9530baaa19ad",
        "vstsBuild",
        accessToken);
}

export function getServiceUriFromCollectionUri(
    serviceUri: string,
    accessToken: string,
    areaName: string,
    areaId: string): Q.Promise<string>{
    return this.getConnectionDataForArea(serviceUri, areaName, areaId, "vstsBuild", accessToken)
        .then((connectionData) => {
            return connectionData.locationServiceData.accessMappings
                .find((mapping) => mapping.moniker === connectionData.locationServiceData.defaultAccessMappingMoniker)
                .accessPoint;
        });
}

export function getServiceUrisFromCollectionUri(
    serviceUri: string,
    accessToken: string,
    areaName: string,
    areaId: string): Q.Promise<string[]>{
    return this.getConnectionDataForArea(serviceUri, areaName, areaId, "vstsBuild", accessToken)
        .then((connectionData) => {
            if (!connectionData) {
                return [];
            }

            const defaultMapping = connectionData.locationServiceData.accessMappings
                .find((mapping) => mapping.moniker === connectionData.locationServiceData.defaultAccessMappingMoniker)
                .accessPoint;
            // It's important that the default mapping is the first one in the list
            // Utility.getNuGetFeedRegistryUrl makes assumptions around this
            const uris = [defaultMapping];
            return uris.concat(
                connectionData.locationServiceData.accessMappings.map((mapping: locationApi.AccessMapping) => {
                    return mapping.accessPoint;
            }));
        });
}

/**
 * - ! -
 * IMPORTANT
 * This should not be used anymore, use utility-common/packaging/locationUtilities instead
 */
export function assumeNuGetUriPrefixes(collectionUri: string): Q.Promise<string[]> {
    const prefixes = [collectionUri];

    const serverType = tl.getVariable("System.ServerType");
    if (!serverType || serverType.toLowerCase() !== "hosted") {
        return Q.resolve(prefixes);
    }

    return this.getServiceUrisFromCollectionUri(
        collectionUri,
        auth.getSystemAccessToken(),
        "nuget",
        "b3be7473-68ea-4a81-bfc7-9530baaa19ad")
        .then((uris: string[]) => {
            return prefixes.concat(uris);
        });
}
