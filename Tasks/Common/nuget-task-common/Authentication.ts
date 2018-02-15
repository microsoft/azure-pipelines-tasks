import * as tl from "vsts-task-lib/task";

export interface IPackageSource {
    feedName: string;
    feedUri: string;
    isInternal: boolean;
}

export class NuGetAuthInfo {
    constructor(
        public uriPrefixes: string[],
        public accessToken: string) {
    }
}

export class NuGetExtendedAuthInfo {
    constructor(
        public internalAuthInfo: InternalAuthInfo,
        public externalAuthInfo?: ExternalAuthInfo[]) {
    }
}

export class InternalAuthInfo
{
    constructor(
        public uriPrefixes: string[],
        public accessToken: string,
        public useCredProvider: string,
        public useCredConfig: boolean) {
    }
}

export class ExternalAuthInfo
{
    constructor(
        public packageSource: IPackageSource,
        public authType: ExternalAuthType) {
    }
}

export class TokenExternalAuthInfo extends ExternalAuthInfo
{
    constructor(
        public packageSource: IPackageSource,
        public token: string)
    {
        super(packageSource, ExternalAuthType.Token);
    }
}

export class UsernamePasswordExternalAuthInfo extends ExternalAuthInfo
{
    constructor(
        public packageSource: IPackageSource,
        public username: string,
        public password: string)
    {
        super(packageSource, ExternalAuthType.UsernamePassword);
    }
}

export class ApiKeyExternalAuthInfo extends ExternalAuthInfo
{
    constructor(
        public packageSource: IPackageSource,
        public apiKey: string)
    {
        super(packageSource, ExternalAuthType.ApiKey);
    }
}

export enum ExternalAuthType
{
    Token, 
    UsernamePassword,
    ApiKey
}

export function getSystemAccessToken(): string {
    tl.debug("Getting credentials for local feeds");
    let auth = tl.getEndpointAuthorization("SYSTEMVSSCONNECTION", false);
    if (auth.scheme === "OAuth") {
        tl.debug("Got auth token");
        return auth.parameters["AccessToken"];
    }
    else {
        tl.warning("Could not determine credentials to use for NuGet");
    }
}
