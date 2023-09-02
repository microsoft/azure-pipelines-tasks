import * as tl from "azure-pipelines-task-lib/task";
import { getPackagingRouteUrl } from "azure-pipelines-tasks-artifacts-common/connectionDataUtils";
import { ProtocolType } from "azure-pipelines-tasks-artifacts-common/protocols";
import { getProjectScopedFeed } from "azure-pipelines-tasks-artifacts-common/stringUtils";
import { getSystemAccessToken } from "azure-pipelines-tasks-artifacts-common/webapi";

export interface IPackageSource {
    feedName: string;
    feedUri: string;
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

    if (feedList.length > 1)
    {
        tl.warning(tl.loc("Warning_OnlyOneFeedAllowed", feedList.length));
    }

    tl.debug(tl.loc("Info_AddingInternalFeeds", feedList.length));

    const localAccessToken = getSystemAccessToken();

    const pypiUploadApiLocationId: string = "C7A75C1B-08AC-4B11-B468-6C7EF835C85E";
    const pypiApiVersion: string = "5.0";

    const feed = getProjectScopedFeed(feedList[0]);
    const feedUri: string = await getPackagingRouteUrl(
        ProtocolType.PyPi,
        pypiApiVersion,
        pypiUploadApiLocationId,
        feed.feedId,
        feed.projectId);

    const packageSource = { feedName: feed.feedId, feedUri: feedUri, isInternalSource: true } as IPackageSource;
    internalAuthArray.push(new AuthInfo(packageSource, AuthType.Token, "build", localAccessToken));

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
    if (endpointNames.length > 1)
    {
        tl.warning(tl.loc("Warning_OnlyOneServiceConnectionAllowed", endpointNames.length));
    }

    const endpointId= endpointNames[0];
    tl.debug(tl.loc("Info_AddingExternalFeeds", endpointNames.length));
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
    return externalAuthArray;
}
