import Q = require('q');
import vstsWebApi = require('vso-node-api/WebApi');
import vstsClientBases = require('vso-node-api/ClientApiBases');
import VsoBaseInterfaces = require('vso-node-api/interfaces/common/VsoBaseInterfaces')

export interface Property {
    $type: string;
    $value: string;
}

export interface Identity {
    id: string;
    descriptor: string;
    providerDisplayName?: string;
    customDisplayName?: string
    properties: { [key: string]: Property }
}

export interface LocationMapping {
    accessMappingMoniker: string;
    location: string;
}

export interface ServiceDefinition {
    serviceOwner: string;
    serviceType: string;
    locationMappings?: LocationMapping[];
    identifier: string;
    displayName: string;
    relativeToSetting?: string;
    toolId: string;
    properties: { [key: string]: Property };
}

export interface AccessMapping {
    displayName: string;
    moniker: string;
    accessPoint: string;
    serviceOwner: string;
    virtualDirectory: string;
}

export interface LocationServiceData {
    serviceOwner: string;
    accessMappings: AccessMapping[];
    defaultAccessMappingMoniker: string;
    serviceDefinitions: ServiceDefinition[];
}

export interface ConnectionData {
    authenticatedUser: Identity;
    authorizedUser: Identity;
    instanceId: string;
    locationServiceData: LocationServiceData;
}

export class LocationApi extends vstsClientBases.ClientApiBase {
    constructor(baseUrl: string, handlers: VsoBaseInterfaces.IRequestHandler[]) {
        super(baseUrl, handlers, "vsts-nuget-build-task")
    }

    public getConnectionData(onResult: (err: any, statusCode: number, connectionData: ConnectionData) => void): void {
        var url = this.vsoClient.resolveUrl("/_apis/connectionData?connectOptions=includeServices");
        this.restClient.getJson(url, "", null, null, onResult)
    }
}

export class QLocationApi extends vstsClientBases.QClientApiBase {
    api: LocationApi;

    constructor(baseUrl: string, handlers: VsoBaseInterfaces.IRequestHandler[]) {
        super(baseUrl, handlers, LocationApi)
    }

    public getConnectionData(): Q.Promise<ConnectionData> {

        var defer = Q.defer<ConnectionData>();

        this.api.getConnectionData((err: any, statusCode: number, connectionData: ConnectionData) => {
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
}