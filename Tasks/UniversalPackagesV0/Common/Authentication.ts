import * as tl from "vsts-task-lib";

export interface IPackageSource {
    accountUrl: string;
    isInternal: boolean;
}

export class InternalAuthInfo
{
    constructor(
        public uriPrefixes: string[],
        public accessToken: string
    ) {
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

export enum ExternalAuthType
{
    Token,
    UsernamePassword,
}

export function getSystemAccessToken(): string {
    tl.debug("Getting credentials for local feeds");
    let auth = tl.getEndpointAuthorization("SYSTEMVSSCONNECTION", false);
    if (auth.scheme === "OAuth") {
        tl.debug("Got auth token");
        return auth.parameters["AccessToken"];
    }
    else {
        tl.warning(tl.loc("Warn_CredentialsNotFound"));
    }
}

export function GetExternalAuthInfo(inputKey: string): ExternalAuthInfo
{
    let externalAuthInfo: ExternalAuthInfo;
    let endpointName = tl.getInput(inputKey);

    const accountUri = tl.getEndpointUrl(endpointName, false);
    let externalAuth = tl.getEndpointAuthorization(endpointName, false);

    switch(externalAuth.scheme.toLocaleLowerCase()) {
        case "token":
            let token = externalAuth.parameters["apitoken"];
            externalAuthInfo = new TokenExternalAuthInfo(<IPackageSource>
                {
                    accountUrl: accountUri
                },
                token);
            break;
        case "usernamepassword":
            tl.error(tl.loc("Error_AuthNotSupported"));
            break;
        default:
            break;
        }

    return externalAuthInfo;
}
