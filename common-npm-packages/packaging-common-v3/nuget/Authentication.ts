export interface IPackageSourceBase {
    feedName: string;
    feedUri: string;
}

export interface IPackageSource extends IPackageSourceBase {
    isInternal: boolean;
}

const NUGET_ORG_V2_URL: string = "https://www.nuget.org/api/v2/";
const NUGET_ORG_V3_URL: string = "https://api.nuget.org/v3/index.json";

export const NuGetOrgV2PackageSource: IPackageSource = {
    feedName: "NuGetOrg",
    feedUri: NUGET_ORG_V2_URL,
    isInternal: false
}

export const NuGetOrgV3PackageSource: IPackageSource = {
    feedName: "NuGetOrg",
    feedUri: NUGET_ORG_V3_URL,
    isInternal: false
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
