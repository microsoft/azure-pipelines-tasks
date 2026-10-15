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
exports.artifactToolRunner = void 0;
exports.validateServerType = validateServerType;
exports.validateVersionInputs = validateVersionInputs;
exports.getSystemAccessToken = getSystemAccessToken;
exports.trySetAuth = trySetAuth;
exports.setFeed = setFeed;
exports.handleTaskError = handleTaskError;
exports.logArtifactToolTelemetry = logArtifactToolTelemetry;
exports.logCommandResult = logCommandResult;
exports.logInfo = logInfo;
const tl = require("azure-pipelines-task-lib");
const telemetry = require("azure-pipelines-tasks-utility-common/telemetry");
const stringUtils_1 = require("azure-pipelines-tasks-artifacts-common/stringUtils");
const webapi_1 = require("azure-pipelines-tasks-artifacts-common/webapi");
const protocols_1 = require("azure-pipelines-tasks-artifacts-common/protocols");
const artifactToolRunner = require("azure-pipelines-tasks-packaging-common/universal/ArtifactToolRunner");
exports.artifactToolRunner = artifactToolRunner;
const UniversalPackageContext_1 = require("./UniversalPackageContext");
function validateServerType() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const serverType = tl.getVariable("System.ServerType");
            if (!serverType || serverType.toLowerCase() !== "hosted") {
                throw new Error(tl.loc("Error_UniversalPackagesNotSupportedOnPrem"));
            }
            return true;
        }
        catch (error) {
            yield handleTaskError(error, tl.loc("Error_UniversalPackagesNotSupportedOnPrem"), undefined);
            return false;
        }
    });
}
function validateVersionInputs(context) {
    if (context.command === UniversalPackageContext_1.OperationType.Download) {
        if (!context.packageVersion) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("Error_PackageVersionRequired"));
            return false;
        }
    }
    else if (context.command === UniversalPackageContext_1.OperationType.Publish) {
        if (context.packageVersion && context.versionIncrement) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("Error_VersionInputsMutuallyExclusive"));
            return false;
        }
        if (!context.packageVersion && !context.versionIncrement) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("Error_VersionInputRequired"));
            return false;
        }
    }
    return true;
}
function getSystemAccessToken() {
    var _a;
    const auth = tl.getEndpointAuthorization('SYSTEMVSSCONNECTION', false);
    return (_a = auth === null || auth === void 0 ? void 0 : auth.parameters) === null || _a === void 0 ? void 0 : _a['AccessToken'];
}
function tryGetSystemAccessToken(context) {
    tl.debug(tl.loc('Debug_UsingBuildServiceCreds'));
    context.accessToken = getSystemAccessToken();
    return !!context.accessToken;
}
function trySetAccessToken(context) {
    return __awaiter(this, void 0, void 0, function* () {
        return tryGetSystemAccessToken(context);
    });
}
function setSystemServiceUri(context) {
    if (!context.adoServiceConnection) {
        context.serviceUri = tl.getEndpointUrlRequired("SYSTEMVSSCONNECTION");
        tl.debug(tl.loc('Debug_UsingServiceUri', context.serviceUri));
    }
}
function setFeedServiceUri(context) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const rootServiceUrl = (0, webapi_1.requireHttpsUrl)(context.serviceUri).href;
            const webApi = (0, webapi_1.getWebApiWithProxy)(rootServiceUrl, context.accessToken, { maxRedirects: 0 });
            const locationApi = yield webApi.getLocationsApi();
            const resourceArea = yield locationApi.getResourceArea((0, protocols_1.getAreaIdForProtocol)(protocols_1.ProtocolType.Universal));
            context.feedServiceUri =
                (0, webapi_1.requireHttpsUrl)(resourceArea.locationUrl).href;
            tl.debug(tl.loc('Debug_FeedServiceUri', context.feedServiceUri));
        }
        catch (error) {
            throw new Error(tl.loc('Error_FailedToResolveFeedUri', context.serviceUri, error.message || error));
        }
    });
}
function setIdentityInformation(context) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            tl.debug(tl.loc('Debug_CreatingLocationApi'));
            const webApi = (0, webapi_1.getWebApiWithProxy)(context.serviceUri, context.accessToken);
            context.locationApi = yield webApi.getLocationsApi();
            tl.debug(tl.loc('Debug_GettingConnectionData'));
            const connectionData = yield context.locationApi.getConnectionData();
            const identity = connectionData === null || connectionData === void 0 ? void 0 : connectionData.authenticatedUser;
            if (identity) {
                context.authIdentityName = identity.customDisplayName || identity.providerDisplayName;
                context.authIdentityId = identity.id;
                tl.debug(tl.loc('Debug_AuthenticatedIdentity', context.authIdentityName, context.authIdentityId));
            }
        }
        catch (error) {
            tl.debug(tl.loc('Debug_FailedToGetIdentityInfo', error));
        }
        (_a = context.authIdentityId) !== null && _a !== void 0 ? _a : (context.authIdentityId = context.adoServiceConnection
            ? tl.getEndpointAuthorizationParameter(context.adoServiceConnection, 'serviceprincipalid', true)
            : context.buildServiceAccountId);
    });
}
function trySetAuth(context) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            setSystemServiceUri(context);
            if (!(yield trySetAccessToken(context))) {
                throw new Error(tl.loc('Error_NoAuthToken'));
            }
            if (!context.serviceUri) {
                throw new Error(tl.loc('Error_FailedToResolveFeedUri', context.feedUrl));
            }
            yield setFeedServiceUri(context);
            yield setIdentityInformation(context);
            const toolRunnerOptions = artifactToolRunner.getOptions();
            toolRunnerOptions.env.UNIVERSAL_AUTH_TOKEN = context.accessToken;
            context.toolRunnerOptions = toolRunnerOptions;
            return true;
        }
        catch (error) {
            yield handleTaskError(error, tl.loc('Error_AuthenticationFailed'), context);
            return false;
        }
    });
}
function setFeed(context) {
    tl.debug(tl.loc('Debug_ParsedFeedInfo', context.serviceUri, context.projectAndFeed));
    const feed = (0, stringUtils_1.getProjectScopedFeed)(context.projectAndFeed);
    context.feedName = feed.feedId;
    context.projectName = feed.projectId;
    if (context.projectName) {
        tl.debug(tl.loc('Debug_ProjectScopedFeed', context.projectName, context.feedName));
    }
    else {
        tl.debug(tl.loc('Debug_OrgScopedFeed', context.feedName));
    }
}
function handleTaskError(err, errorMessage, context) {
    return __awaiter(this, void 0, void 0, function* () {
        tl.error(err);
        if (context === null || context === void 0 ? void 0 : context.adoServiceConnection) {
            tl.warning(tl.loc("Warning_ServiceConnectionIdentityHint", context.adoServiceConnection, context.authIdentityName, context.authIdentityId));
        }
        else if (context) {
            tl.warning(tl.loc("Warning_BuildServiceIdentityHint", context.authIdentityName, context.authIdentityId));
        }
        tl.setResult(tl.TaskResult.Failed, errorMessage);
    });
}
function logArtifactToolTelemetry(context) {
    try {
        let artifactToolTelemetry = {
            "command": context.command,
            "feed": context.projectAndFeed,
            "packageName": context.packageName,
            "packageVersion": context.packageVersion,
            "versionIncrement": context.versionIncrement,
            "adoServiceConnection": context.adoServiceConnection,
            "artifactToolPath": context.artifactToolPath,
            "pipelineCollectionUri": context.pipelineCollectionUri,
        };
        telemetry.emitTelemetry("Packaging", "UniversalPackagesV1", artifactToolTelemetry);
    }
    catch (err) {
        tl.debug(tl.loc('Debug_TelemetryInitFailed', err));
    }
}
function logCommandResult(area, feature, resultCode) {
    try {
        telemetry.logResult(area, feature, resultCode);
    }
    catch (err) {
        tl.debug(tl.loc('Debug_TelemetryResultFailed', err));
    }
}
function logInfo(key, ...params) {
    console.log(tl.loc(key, ...params));
}
