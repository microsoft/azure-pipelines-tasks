import * as tl from "azure-pipelines-task-lib/task";
import * as pkgLocationUtils from "azure-pipelines-tasks-packaging-common-v3/locationUtilities";
import { getProjectAndFeedIdFromInput, logError } from 'azure-pipelines-tasks-packaging-common-v3/util';

export interface IPackageSource {
    feedUri: string;
    feedName: string;
    isInternalSource: boolean;
}

export enum AuthType
{
    Token,
    UsernamePassword,
}
 // tslint:disable-next-line:max-classes-per-file
export class AuthInfo
{
    public authType: AuthType;
    public packageSource: IPackageSource;
    public username: string;
    public password: string;

    constructor(packageSource: IPackageSource, authType: AuthType, username: string, password: string)
    {
        this.packageSource = packageSource;
        this.authType = authType;
        this.username = username;
        this.password = password;
    }
}

export async function getInternalAuthInfoArray(inputKey: string): Promise<AuthInfo[]> {
    let internalAuthArray: AuthInfo[] = [];
    const feedList  = tl.getDelimitedInput(inputKey, ",");
    if (!feedList || feedList.length === 0)
    {
        return internalAuthArray;
    }

    tl.debug(tl.loc("Info_AddingInternalFeeds", feedList.length));

    let packagingLocation: string;
    const serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
    const localAccessToken = pkgLocationUtils.getSystemAccessToken();
    try {
        // This call is to get the packaging URI(abc.pkgs.vs.com) which is same for all protocols.
        packagingLocation = await pkgLocationUtils.getNuGetUriFromBaseServiceUri(
            serviceUri,
            localAccessToken);
    } catch (error) {
        tl.debug(tl.loc("FailedToGetPackagingUri"));
        logError(error);
        packagingLocation = serviceUri;
    }

    internalAuthArray = await Promise.all(feedList.map(async (feedName:string) => {
        const feed = getProjectAndFeedIdFromInput(feedName)
        const feedUri = await pkgLocationUtils.getFeedRegistryUrl(
            packagingLocation,
            pkgLocationUtils.RegistryType.PyPiUpload,
            feed.feedId,
            feed.projectId,
            localAccessToken,
            true /* useSession */);
        return new AuthInfo({
            feedName,
            feedUri,
            isInternalSource: true,
            } as IPackageSource,
            AuthType.Token,
            "build",
            localAccessToken,
        );
    }));

    return internalAuthArray;
}

export async function getExternalAuthInfoArray(inputKey: string): Promise<AuthInfo[]>
{
    let externalAuthArray: AuthInfo[] = [];
    let endpointNames = tl.getDelimitedInput(inputKey, ",");

    if (!endpointNames || endpointNames.length === 0)
    {
        return externalAuthArray;
    }

    tl.debug(tl.loc("Info_AddingExternalFeeds", endpointNames.length));
    for (let endpointId of endpointNames)
    {
        let feedUri = tl.getEndpointUrl(endpointId, false);
        let endpointName = tl.getEndpointDataParameter(endpointId, "endpointname", false);
        let externalAuth = tl.getEndpointAuthorization(endpointId, true);
        let scheme = tl.getEndpointAuthorizationScheme(endpointId, true).toLowerCase();
        switch(scheme) {
            case "token":
                const token = externalAuth.parameters["apitoken"];
                tl.debug(tl.loc("Info_AddingTokenAuthEntry", feedUri));
                externalAuthArray.push(new AuthInfo({
                        feedName: endpointName,
                        feedUri,
                        isInternalSource: false,
                    } as IPackageSource,
                    AuthType.Token,
                    "build", // fake username, could be anything.
                    token,
                    ));
                break;
            case "usernamepassword":
                let username = externalAuth.parameters["username"];
                let password = externalAuth.parameters["password"];
                tl.debug(tl.loc("Info_AddingPasswordAuthEntry", feedUri));
                externalAuthArray.push(new AuthInfo({
                        feedName: endpointName,
                        feedUri,
                        isInternalSource: false,
                    } as IPackageSource,
                    AuthType.UsernamePassword,
                    username,
                    password));
                break;
            case "none":
            default:
                break;
        }
    }
    return externalAuthArray;
}
