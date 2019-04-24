import * as tl from "azure-pipelines-task-lib/task";

export interface IPackageSource {
    feedUri: string;
    isInternal: boolean;
}

export enum ExternalAuthType
{
    Token,
    UsernamePassword,
}

// tslint:disable-next-line:max-classes-per-file
export class ExternalAuthInfo
{
    public authType: ExternalAuthType;
    public packageSource: IPackageSource;
    public username: string;
    public password: string;

    constructor(packageSource: IPackageSource, authType: ExternalAuthType, username: string, password: string)
    {
        this.packageSource = packageSource;
        this.authType = authType;
        this.username = username;
        this.password = password;
    }
}

export function getExternalAuthInfoArray(endpointNames: string[]): ExternalAuthInfo[]
{
    let externalAuthArray: ExternalAuthInfo[] = [];

    if (!endpointNames || endpointNames.length === 0)
    {
        return externalAuthArray;
    }

    tl.debug(tl.loc("Info_AddingExternalFeeds", endpointNames.length));
    endpointNames.forEach((endpointName: string) => {
        let feedUri = tl.getEndpointUrl(endpointName, false);
        let externalAuth = tl.getEndpointAuthorization(endpointName, true);
        let scheme = tl.getEndpointAuthorizationScheme(endpointName, true).toLowerCase();

        switch(scheme) {
            case "token":
                const token = externalAuth.parameters["apitoken"];
                tl.debug(tl.loc("Info_AddingTokenAuthEntry", feedUri));
                externalAuthArray.push(new ExternalAuthInfo(<IPackageSource>
                    {
                        feedUri: feedUri
                    },
                    ExternalAuthType.Token,
                    "build", // Fake username, could be anything.
                    token,
                    ));
                break;
            case "usernamepassword":
                let username = externalAuth.parameters["username"];
                let password = externalAuth.parameters["password"];
                tl.debug(tl.loc("Info_AddingPasswordAuthEntry", feedUri));
                externalAuthArray.push(new ExternalAuthInfo(<IPackageSource>
                    {
                        feedUri: feedUri
                    },
                    ExternalAuthType.UsernamePassword,
                    username,
                    password));
                break;
            case "none":
            default:
                break;
        }
    });
    return externalAuthArray;
}
