"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthInfo = exports.AuthType = void 0;
exports.getInternalAuthInfoArray = getInternalAuthInfoArray;
exports.getExternalAuthInfoArray = getExternalAuthInfoArray;
const tl = require("azure-pipelines-task-lib/task");
const connectionDataUtils_1 = require("azure-pipelines-tasks-artifacts-common/connectionDataUtils");
const protocols_1 = require("azure-pipelines-tasks-artifacts-common/protocols");
const stringUtils_1 = require("azure-pipelines-tasks-artifacts-common/stringUtils");
const webapi_1 = require("azure-pipelines-tasks-artifacts-common/webapi");
const feedUrlUtils_1 = require("azure-pipelines-tasks-artifacts-common/feedUrlUtils");
var AuthType;
(function (AuthType) {
    AuthType[AuthType["Token"] = 0] = "Token";
    AuthType[AuthType["UsernamePassword"] = 1] = "UsernamePassword";
})(AuthType || (exports.AuthType = AuthType = {}));
// tslint:disable-next-line:max-classes-per-file
class AuthInfo {
    constructor(packageSource, authType, username, password) {
        this.packageSource = packageSource;
        this.authType = authType;
        this.username = username;
        this.password = password;
        tl.setSecret(password);
    }
}
exports.AuthInfo = AuthInfo;
function getInternalAuthInfoArray(inputKey) {
    return __awaiter(this, void 0, void 0, function* () {
        let internalAuthArray = new Set();
        const feedList = tl.getDelimitedInput(inputKey, ",");
        if (!feedList || feedList.length === 0) {
            return internalAuthArray;
        }
        if (feedList.length > 1) {
            tl.warning(tl.loc("Warning_OnlyOneFeedAllowed", feedList.length));
        }
        tl.debug(tl.loc("Info_AddingInternalFeeds", feedList.length));
        const localAccessToken = (0, webapi_1.getSystemAccessToken)();
        const pypiUploadApiLocationId = "C7A75C1B-08AC-4B11-B468-6C7EF835C85E";
        const pypiApiVersion = "5.0";
        const feed = (0, stringUtils_1.getProjectScopedFeed)(feedList[0]);
        const feedUri = yield (0, connectionDataUtils_1.getPackagingRouteUrl)(protocols_1.ProtocolType.PyPi, pypiApiVersion, pypiUploadApiLocationId, feed.feedId, feed.projectId);
        const verifiedFeedUri = yield (0, feedUrlUtils_1.verifyAzureArtifactsFeedUrl)(new URL(feedUri), protocols_1.ProtocolType.PyPi);
        const packageSource = { feedName: feed.feedId, feedUri: verifiedFeedUri.href, isInternalSource: true };
        internalAuthArray.add(new AuthInfo(packageSource, AuthType.Token, "build", localAccessToken));
        return internalAuthArray;
    });
}
function getExternalAuthInfoArray(inputKey) {
    return __awaiter(this, void 0, void 0, function* () {
        let externalAuthArray = new Set();
        let endpointNames = tl.getDelimitedInput(inputKey, ",");
        if (!endpointNames || endpointNames.length === 0) {
            return externalAuthArray;
        }
        if (endpointNames.length > 1) {
            tl.warning(tl.loc("Warning_OnlyOneServiceConnectionAllowed", endpointNames.length));
        }
        const endpointId = endpointNames[0];
        tl.debug(tl.loc("Info_AddingExternalFeeds", endpointNames.length));
        let feedUri = tl.getEndpointUrl(endpointId, false);
        let endpointName = tl.getEndpointDataParameter(endpointId, "endpointname", false);
        let externalAuth = tl.getEndpointAuthorization(endpointId, true);
        let scheme = tl.getEndpointAuthorizationScheme(endpointId, true).toLowerCase();
        switch (scheme) {
            case "token":
                const token = externalAuth.parameters["apitoken"];
                tl.debug(tl.loc("Info_AddingTokenAuthEntry", feedUri));
                externalAuthArray.add(new AuthInfo({
                    feedName: endpointName,
                    feedUri,
                    isInternalSource: false,
                }, AuthType.Token, "build", // fake username, could be anything.
                token));
                break;
            case "usernamepassword":
                let username = externalAuth.parameters["username"];
                let password = externalAuth.parameters["password"];
                tl.debug(tl.loc("Info_AddingPasswordAuthEntry", feedUri));
                externalAuthArray.add(new AuthInfo({
                    feedName: endpointName,
                    feedUri,
                    isInternalSource: false,
                }, AuthType.UsernamePassword, username, password));
                break;
            case "none":
            default:
                break;
        }
        return externalAuthArray;
    });
}
