import * as common from "azure-pipelines-tasks-artifacts-common/serviceConnectionUtils";
import * as tl from "azure-pipelines-task-lib/task";
import * as url from "url";

export function getUriWithCredentials(serviceConnection: common.ServiceConnection): string{
    let username: string;
    let password: string;
    let endpointUrl: string;
    switch (serviceConnection.authType) {
        case (common.ServiceConnectionAuthType.UsernamePassword):
            const usernamePasswordAuthInfo = serviceConnection as common.UsernamePasswordServiceConnection;
            endpointUrl = serviceConnection.packageSource.uri;
            username = usernamePasswordAuthInfo.username;
            password = usernamePasswordAuthInfo.password;
            tl.debug(`Detected username/password credentials for '${endpointUrl}'`);
            break;
        case (common.ServiceConnectionAuthType.Token):
            const tokenAuthInfo = serviceConnection as common.TokenServiceConnection;
            endpointUrl = serviceConnection.packageSource.uri;
            username = "build";
            password = tokenAuthInfo.token;
            tl.debug(`Detected token credentials for '${serviceConnection.packageSource.uri}'`);
            break;
        case (common.ServiceConnectionAuthType.ApiKey):
        default:
            break;
    }
    return addCredentialsToUri(username, password, endpointUrl);
}

export function addCredentialsToUri(username: string, password: string, uri: string) {
    try{
        const authenticationString = username + ":" + password;
        let parsedUrl = url.parse(uri);
        parsedUrl.auth = authenticationString;
        return url.format(parsedUrl);
    } catch (error){
        throw new Error(tl.loc("Error_FailedToParseFeedUrlAndAuth", error));
    }
}