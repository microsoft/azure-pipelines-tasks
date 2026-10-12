"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUriWithCredentials = getUriWithCredentials;
exports.addCredentialsToUri = addCredentialsToUri;
const common = require("azure-pipelines-tasks-artifacts-common/serviceConnectionUtils");
const tl = require("azure-pipelines-task-lib/task");
function getUriWithCredentials(serviceConnection) {
    let username;
    let password;
    let endpointUrl;
    switch (serviceConnection.authType) {
        case (common.ServiceConnectionAuthType.UsernamePassword):
            const usernamePasswordAuthInfo = serviceConnection;
            endpointUrl = serviceConnection.packageSource.uri;
            username = usernamePasswordAuthInfo.username;
            password = usernamePasswordAuthInfo.password;
            tl.debug(`Detected username/password credentials for '${endpointUrl}'`);
            break;
        case (common.ServiceConnectionAuthType.Token):
            const tokenAuthInfo = serviceConnection;
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
function addCredentialsToUri(username, password, uri) {
    try {
        const parsedUrl = new URL(uri);
        parsedUrl.username = username;
        parsedUrl.password = password;
        return parsedUrl.href;
    }
    catch (error) {
        throw new Error(tl.loc("Error_FailedToParseFeedUrlAndAuth", error));
    }
}
