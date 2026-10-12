"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const path = __importStar(require("path"));
const tl = __importStar(require("azure-pipelines-task-lib/task"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const telemetry_1 = require("azure-pipelines-tasks-artifacts-common/telemetry");
const npmauthutils = __importStar(require("./npmauthutils"));
const npmrcBackupManager_1 = require("./npmrcBackupManager");
let internalFeedSuccessCount = 0;
let externalFeedSuccessCount = 0;
let federatedFeedAuthSuccessCount = 0;
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        tl.setResourcePath(path.join(__dirname, 'task.json'));
        // Path to user provided npmrc
        const npmrc = npmauthutils.validateNpmrcPath();
        const previouslyAuthenticatedUrls = npmauthutils.getPreviouslyAuthenticatedUrls();
        // Preserve the original user provided .npmrc on first task execution, so the post-job cleanup can restore it. 
        const backupDirectory = npmauthutils.initializeBackupDirectory();
        const backupManager = new npmrcBackupManager_1.NpmrcBackupManager(backupDirectory);
        const fileIdentity = backupManager.ensureBackedUp(npmrc);
        tl.setTaskVariable(npmrcBackupManager_1.NpmrcFileIdentityTaskVariable, JSON.stringify(fileIdentity));
        let npmrcRegistries = npmauthutils.getRegistriesFromNpmrc(npmrc);
        let packagingLocation;
        try {
            packagingLocation = yield npmauthutils.resolvePackagingLocation();
        }
        catch (error) {
            tl.error(tl.loc('Error_UnableToGetPackagingUris'));
            throw error;
        }
        // Collect internal feeds (from .npmrc) and external registries (from service connections)
        const internalFeedCredentials = npmauthutils.resolveInternalFeedCredentials(npmrc, packagingLocation.PackagingUris);
        const endpointRegistries = yield npmauthutils.resolveEndpointRegistries(previouslyAuthenticatedUrls);
        // Read the target .npmrc into memory for credential line replacement
        const npmrcFile = fs.readFileSync(npmrc, 'utf8').split(os.EOL);
        const addedRegistries = [];
        const entraWifServiceConnectionName = tl.getInput("workloadIdentityServiceConnection");
        const feedUrl = tl.getInput("feedUrl");
        if (entraWifServiceConnectionName) {
            npmrcRegistries = npmauthutils.validateAndFilterRegistryUrls(npmrcRegistries);
            // When feedUrl is provided, only add WIF credentials for matching registries in the npmrc.
            // Otherwise, apply WIF credentials to all registries (pre-feedUrl input behavior).
            if (feedUrl) {
                npmrcRegistries = npmrcRegistries.filter(x => npmauthutils.toNerfDart(x) === npmauthutils.toNerfDart(feedUrl));
                if (npmrcRegistries.length === 0) {
                    throw new Error(tl.loc("IgnoringRegistry", feedUrl));
                }
            }
            else {
                tl.debug(tl.loc('Info_ApplyingWifToAllRegistries', npmrcRegistries.length));
            }
        }
        else if (feedUrl) {
            throw new Error(tl.loc("MissingFeedUrlOrServiceConnection"));
        }
        for (const registryUrlString of npmrcRegistries) {
            let registryURL;
            try {
                registryURL = new URL(registryUrlString);
            }
            catch (_a) {
                tl.warning(tl.loc('InvalidRegistryUrl', registryUrlString));
                continue;
            }
            // Auth resolution priority: WIF > external service connection > internal feed.
            // First match wins; subsequent sources are skipped for this registry.
            if (entraWifServiceConnectionName) {
                const credentials = yield npmauthutils.getAzureDevOpsServiceConnectionCredentials(entraWifServiceConnectionName, registryUrlString);
                console.log(tl.loc("Info_AddingFederatedFeedAuth", entraWifServiceConnectionName, registryUrlString));
                console.log(tl.loc("AddingEndpointCredentials", entraWifServiceConnectionName));
                const npmrcEntry = {
                    url: credentials.feedUrl.href,
                    auth: `${npmauthutils.toNerfDart(credentials.feedUrl.href)}:_authToken=${credentials.accessToken}`
                };
                writeCredentialEntry(npmrc, npmrcFile, npmrcEntry, credentials.feedUrl, addedRegistries);
                federatedFeedAuthSuccessCount++;
                console.log(tl.loc("Info_SuccessAddingFederatedFeedAuth", registryUrlString));
                continue;
            }
            if (endpointRegistries.length > 0) {
                const npmrcEntry = npmauthutils.tryResolveFromEndpoints(registryUrlString, endpointRegistries);
                if (npmrcEntry) {
                    console.log(tl.loc("AddingEndpointCredentials", registryURL.host));
                    writeCredentialEntry(npmrc, npmrcFile, npmrcEntry, new URL(npmrcEntry.url), addedRegistries);
                    externalFeedSuccessCount++;
                    continue;
                }
            }
            const npmrcEntry = npmauthutils.tryResolveFromLocalRegistries(registryUrlString, internalFeedCredentials, previouslyAuthenticatedUrls, registryURL.host);
            if (npmrcEntry) {
                console.log(tl.loc("AddingLocalCredentials"));
                writeCredentialEntry(npmrc, npmrcFile, npmrcEntry, new URL(npmrcEntry.url), addedRegistries);
                internalFeedSuccessCount++;
                continue;
            }
            console.log(tl.loc("IgnoringRegistry", registryURL.host));
        }
    });
}
/** Removes any pre-existing credential lines for the registry, then appends fresh auth. */
function writeCredentialEntry(npmrcPath, npmrcFile, entry, registryURL, addedRegistries) {
    addedRegistries.push(registryURL);
    npmauthutils.removeExistingCredentialEntries(npmrcPath, npmrcFile, registryURL, addedRegistries);
    tl.debug(tl.loc('AddingAuthRegistry', entry.url));
    npmauthutils.appendAuthToNpmrc(npmrcPath, entry.auth);
    npmrcFile.push(os.EOL + entry.auth + os.EOL);
}
main().catch(error => {
    if (tl.getVariable("NPM_AUTHENTICATE_TEMP_DIRECTORY")) {
        tl.rmRF(tl.getVariable("NPM_AUTHENTICATE_TEMP_DIRECTORY"));
        // Clear the variables after we rm-rf the main root directory
        tl.setVariable("SAVE_NPMRC_PATH", "", false);
        tl.setVariable("NPM_AUTHENTICATE_TEMP_DIRECTORY", "", false);
    }
    tl.setResult(tl.TaskResult.Failed, error);
}).finally(() => {
    (0, telemetry_1.emitTelemetry)("Packaging", "NpmAuthenticateV0", {
        "InternalFeedAuthCount": internalFeedSuccessCount,
        "ExternalFeedAuthCount": externalFeedSuccessCount,
        "FederatedFeedAuthCount": federatedFeedAuthSuccessCount
    });
});
