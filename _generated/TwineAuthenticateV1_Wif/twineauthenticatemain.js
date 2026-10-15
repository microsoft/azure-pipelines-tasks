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
exports.Repository = void 0;
const fs = require("fs");
const os = require("os");
const path = require("path");
const tl = require("azure-pipelines-task-lib");
const telemetry_1 = require("azure-pipelines-tasks-artifacts-common/telemetry");
const auth = require("./authentication");
const utils = require("./utilities");
const EntraWifUserServiceConnectionUtils_1 = require("azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils");
const protocols_1 = require("azure-pipelines-tasks-artifacts-common/protocols");
// tslint:disable-next-line:max-classes-per-file
class Repository {
    constructor(feedName, repository, username, password) {
        this.feedName = feedName;
        this.repository = repository;
        this.username = username;
        this.password = password;
    }
    toString() {
        return `[${this.feedName}]${os.EOL}repository=${this.repository}${os.EOL}username=${this.username}${os.EOL}password=${this.password}`;
    }
}
exports.Repository = Repository;
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        tl.setResourcePath(path.join(__dirname, "task.json"));
        tl.setResourcePath(path.join(__dirname, "node_modules/azure-pipelines-tasks-artifacts-common/module.json"));
        let internalFeedSuccessCount = 0;
        let externalFeedSuccessCount = 0;
        let federatedFeedSuccessCount = 0;
        try {
            // Local feed
            const internalFeed = yield auth.getInternalAuthInfoArray("artifactFeed");
            // external service endpoint
            const externalEndpoints = yield auth.getExternalAuthInfoArray("pythonUploadServiceConnection");
            // combination of both internal and external
            const newEndpointsToAdd = new Set([...internalFeed, ...externalEndpoints]);
            let pypircPath = utils.getPypircPath();
            const entraWifServiceConnectionName = tl.getInput("workloadIdentityServiceConnection");
            const feedUrl = tl.getInput("feedUrl");
            if (entraWifServiceConnectionName && feedUrl) {
                const credentials = yield (0, EntraWifUserServiceConnectionUtils_1.getFederatedWorkloadIdentityCredentialsForFeed)(entraWifServiceConnectionName, feedUrl, protocols_1.ProtocolType.PyPi);
                if (!credentials) {
                    throw new Error(tl.loc("Error_FailedToGetServiceConnectionAuth", entraWifServiceConnectionName));
                }
                const urlPieces = credentials.feedUrl.pathname.split('/');
                let feedName = '';
                urlPieces[urlPieces.length - 1] === '' ? feedName = urlPieces[urlPieces.length - 4] : feedName = urlPieces[urlPieces.length - 3];
                tl.debug(tl.loc("Info_AddingAuthForRegistry", feedName));
                const header = `[distutils]${os.EOL}index-servers=${feedName}`;
                const wifRepo = new Repository(feedName, credentials.feedUrl.href, entraWifServiceConnectionName, credentials.accessToken);
                fs.writeFileSync(pypircPath, header + os.EOL + os.EOL + wifRepo.toString());
                federatedFeedSuccessCount++;
                setPypircEnvVar(pypircPath);
                console.log(tl.loc("Info_SuccessAddingAuth", internalFeedSuccessCount, externalFeedSuccessCount, federatedFeedSuccessCount));
                return;
            }
            else if (entraWifServiceConnectionName || feedUrl) {
                throw new Error(tl.loc("Error_MissingFeedUrlOrServiceConnection"));
            }
            // create new file. We do not merge existing files and always create a fresh file
            fs.writeFileSync(pypircPath, formPypircFormatFromData(newEndpointsToAdd));
            setPypircEnvVar(pypircPath);
            // Configuring the pypirc file
            internalFeedSuccessCount = internalFeed.size;
            externalFeedSuccessCount = externalEndpoints.size;
            console.log(tl.loc("Info_SuccessAddingAuth", internalFeedSuccessCount, externalFeedSuccessCount, federatedFeedSuccessCount));
        }
        catch (error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToAddAuthentication"));
            return;
        }
        finally {
            (0, telemetry_1.emitTelemetry)("Packaging", "TwineAuthenticateV1", {
                "InternalFeedAuthCount": internalFeedSuccessCount,
                "ExternalFeedAuthCount": externalFeedSuccessCount,
                "FederatedFeedAuthCount": federatedFeedSuccessCount,
            });
        }
    });
}
function findDuplicatesInArray(array) {
    return array.filter((e, i, a) => a.indexOf(e) !== i);
}
function formPypircFormatFromData(authInfoSet) {
    const authInfo = Array.from(authInfoSet);
    let feedNames = authInfo.map(entry => entry.packageSource.feedName);
    let duplicateFeeds = findDuplicatesInArray(feedNames);
    if (duplicateFeeds.length > 0) {
        throw new Error(tl.loc("Error_DuplicateEntryForFeed", duplicateFeeds.join(", ")));
    }
    feedNames.forEach(feedName => console.log(tl.loc("Info_AddingAuthForRegistry", feedName)));
    let header = `[distutils]${os.EOL}index-servers=${feedNames.join(" ")}`;
    let repositories = authInfo.map(entry => new Repository(entry.packageSource.feedName, entry.packageSource.feedUri, entry.username, entry.password));
    let repositoriesEncodedStr = repositories.map(repo => repo.toString()).join(`${os.EOL}${os.EOL}`);
    return header + os.EOL + os.EOL + repositoriesEncodedStr;
}
function setPypircEnvVar(pypircPath) {
    tl.setVariable("PYPIRC_PATH", pypircPath, false);
    tl.debug(tl.loc("VariableSetForPypirc", pypircPath));
}
main();
