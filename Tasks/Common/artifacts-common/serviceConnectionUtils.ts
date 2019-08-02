import * as tl from "azure-pipelines-task-lib/task";

export interface IExternalPackageSource {
    /**
     * The protocol-specific URI used to access the package source
     */
    uri: string;
}

export abstract class ServiceConnection
{
    constructor(
        public packageSource: IExternalPackageSource,
        public authType: ServiceConnectionAuthType) {
    }
}

export class TokenServiceConnection extends ServiceConnection
{
    constructor(
        public packageSource: IExternalPackageSource,
        public token: string)
    {
        super(packageSource, ServiceConnectionAuthType.Token);
    }
}

export class UsernamePasswordServiceConnection extends ServiceConnection
{
    constructor(
        public packageSource: IExternalPackageSource,
        public username: string,
        public password: string)
    {
        super(packageSource, ServiceConnectionAuthType.UsernamePassword);
    }
}

export class ApiKeyServiceConnection extends ServiceConnection
{
    constructor(
        public packageSource: IExternalPackageSource,
        public apiKey: string)
    {
        super(packageSource, ServiceConnectionAuthType.ApiKey);
    }
}

export enum ServiceConnectionAuthType
{
    Token, 
    UsernamePassword,
    ApiKey
}

/**
 * Parses service connections / service endpoints from a task input into strongly typed objects containing the URI and credentials.
 * 
 * @param endpointsInputName The name of the task input containing the service connections endpoints
 */
export function getPackagingServiceConnections(endpointsInputName: string): ServiceConnection[]
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
                    token));
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
                    password));
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
                    apiKey));
                break;
            default: 
                throw Error(tl.loc("ServiceConnections_Error_FailedToParseServiceEndpoint_BadScheme", uri, endpointAuthScheme));
        }
    });

    return serviceConnections;
}