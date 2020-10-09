import * as tl from "azure-pipelines-task-lib/task";
import path = require('path');

tl.setResourcePath(path.join(__dirname , 'module.json'), true);

export interface IExternalPackageSource {
    /**
     * The protocol-specific URI used to access the package source
     */
    uri: string;
}

export interface IAdditionalData {
    [x: string]: string
}

export abstract class ServiceConnection
{
    constructor(
        public packageSource: IExternalPackageSource,
        public authType: ServiceConnectionAuthType,
        public additionalData?: IAdditionalData) {
    }
}

export class TokenServiceConnection extends ServiceConnection
{
    constructor(
        public packageSource: IExternalPackageSource,
        public token: string,
        public additionalData?: IAdditionalData)
    {
        super(packageSource, ServiceConnectionAuthType.Token, additionalData);
    }
}

export class UsernamePasswordServiceConnection extends ServiceConnection
{
    constructor(
        public packageSource: IExternalPackageSource,
        public username: string,
        public password: string,
        public additionalData?: IAdditionalData)
    {
        super(packageSource, ServiceConnectionAuthType.UsernamePassword, additionalData);
    }
}

export class ApiKeyServiceConnection extends ServiceConnection
{
    constructor(
        public packageSource: IExternalPackageSource,
        public apiKey: string,
        public additionalData?: IAdditionalData)
    {
        super(packageSource, ServiceConnectionAuthType.ApiKey, additionalData);
    }
}

export class PrivateKeyServiceConnection extends ServiceConnection {
    constructor(
        public packageSource: IExternalPackageSource,
        public privateKey: string,
        public passphrase: string,
        public additionalData?: IAdditionalData) 
    {
        super(packageSource, ServiceConnectionAuthType.PrivateKey, additionalData)
    }
}

export enum ServiceConnectionAuthType
{
    Token, 
    UsernamePassword,
    ApiKey,
    PrivateKey
}

/**
 * Parses service connections / service endpoints from a task input into strongly typed objects containing the URI and credentials.
 * 
 * @param endpointsInputName The name of the task input containing the service connections endpoints
 */
export function getPackagingServiceConnections(endpointsInputName: string, dataParameters?: string[]): ServiceConnection[]
{
    let endpointNames = tl.getDelimitedInput(endpointsInputName, ',');

    if (!endpointNames || endpointNames.length === 0)
    {
        return [];
    }

    let serviceConnections: ServiceConnection[] = [];
    endpointNames.forEach((endpointName: string) => {
        let uri = tl.getEndpointUrl(endpointName, false);
        let endpointAuth = tl.getEndpointAuthorization(endpointName, true);
        let endpointAuthScheme = tl.getEndpointAuthorizationScheme(endpointName, true).toLowerCase();
        let additionalData = getAdditionalDataParameters(endpointName, dataParameters);
        switch (endpointAuthScheme) {
            case "token":
                if (!("apitoken" in endpointAuth.parameters)) {
                    throw Error(tl.loc("ServiceConnections_Error_FailedToParseServiceEndpoint_MissingParameter", uri, "apitoken"));
                }

                let token = endpointAuth.parameters["apitoken"];
                tl.debug("Found token service connection for package source " + uri);
                serviceConnections.push(new TokenServiceConnection(
                    {
                        uri: uri
                    },
                    token,
                    additionalData));
                break;
            case "usernamepassword":
                if (!("username" in endpointAuth.parameters)) {
                    throw Error(tl.loc("ServiceConnections_Error_FailedToParseServiceEndpoint_MissingParameter", uri, "username"));
                }

                if (!("password" in endpointAuth.parameters)) {
                    throw Error(tl.loc("ServiceConnections_Error_FailedToParseServiceEndpoint_MissingParameter", uri, "password"));
                }

                let username = endpointAuth.parameters["username"];
                let password = endpointAuth.parameters["password"];
                tl.debug("Found username/password service connection for package source " + uri);
                serviceConnections.push(new UsernamePasswordServiceConnection(
                    {
                        uri: uri
                    },
                    username,
                    password,
                    additionalData));
                break;
            case "privatekey":
                if (!("privateKey" in endpointAuth.parameters)) {
                    throw Error(tl.loc("ServiceConnections_Error_FailedToParseServiceEndpoint_MissingParameter", uri, "privatekey"));
                }
                let privateKey = endpointAuth.parameters["privateKey"];
                let passphrase = endpointAuth.parameters["passphrase"];
                tl.debug("Found privateKey/passphrase service connection for package source " + uri);
                serviceConnections.push(new PrivateKeyServiceConnection(
                    {
                        uri: uri
                    },
                    privateKey,
                    passphrase,
                    additionalData));
                break;
            case "none": // We only support this for nuget today. npm and python tasks do not use this endpoint auth scheme.
                if (!("nugetkey" in endpointAuth.parameters)) {
                    throw Error(tl.loc("ServiceConnections_Error_FailedToParseServiceEndpoint_MissingParameter", uri, "nugetkey"));
                }

                let apiKey = endpointAuth.parameters["nugetkey"];
                tl.debug("Found nuget apikey service connection for package source " + uri);
                serviceConnections.push(new ApiKeyServiceConnection(
                    {
                        uri: uri
                    },
                    apiKey,
                    additionalData));
                break;
            default: 
                throw Error(tl.loc("ServiceConnections_Error_FailedToParseServiceEndpoint_BadScheme", uri, endpointAuthScheme));
        }
    });

    return serviceConnections;
}

function getAdditionalDataParameters(endpointName: string, dataParameters?: string[]): IAdditionalData { 
    var additionalData: IAdditionalData = {};

    if(!dataParameters) {
        return additionalData;
    }

    for (let dataParameter of dataParameters) {
        let dataValue = tl.getEndpointDataParameter(endpointName, dataParameter, false);
        if(dataValue) {
            additionalData[dataParameter] = dataValue;
        }
    }

    return additionalData;
}