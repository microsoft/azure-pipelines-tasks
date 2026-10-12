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
exports.validateAndFilterRegistryUrls = validateAndFilterRegistryUrls;
exports.normalizeRegistry = normalizeRegistry;
exports.toNerfDart = toNerfDart;
exports.validateNpmrcPath = validateNpmrcPath;
exports.getPreviouslyAuthenticatedUrls = getPreviouslyAuthenticatedUrls;
exports.initializeBackupDirectory = initializeBackupDirectory;
exports.resolvePackagingLocation = resolvePackagingLocation;
exports.resolveInternalFeedCredentials = resolveInternalFeedCredentials;
exports.resolveEndpointRegistries = resolveEndpointRegistries;
exports.tryResolveFromEndpoints = tryResolveFromEndpoints;
exports.tryResolveFromLocalRegistries = tryResolveFromLocalRegistries;
exports.getRegistriesFromNpmrc = getRegistriesFromNpmrc;
exports.appendAuthToNpmrc = appendAuthToNpmrc;
exports.removeExistingCredentialEntries = removeExistingCredentialEntries;
exports.getAzureDevOpsServiceConnectionCredentials = getAzureDevOpsServiceConnectionCredentials;
const path = __importStar(require("path"));
const tl = __importStar(require("azure-pipelines-task-lib/task"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const constants = __importStar(require("./constants"));
const ini = __importStar(require("ini"));
const pkgLocationUtils = __importStar(require("azure-pipelines-tasks-packaging-common/locationUtilities"));
const npmrcCredential_1 = require("./npmrcCredential");
const EntraWifUserServiceConnectionUtils_1 = require("azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils");
const protocols_1 = require("azure-pipelines-tasks-artifacts-common/protocols");
const feedUrlUtils_1 = require("azure-pipelines-tasks-artifacts-common/feedUrlUtils");
function validateAndFilterRegistryUrls(registryUrls) {
    const secureHosts = new Set();
    const insecureHosts = new Set();
    const validRegistryUrls = [];
    for (const registryUrl of registryUrls) {
        let parsed;
        try {
            parsed = new URL(registryUrl);
        }
        catch (_a) {
            console.log(tl.loc('InvalidRegistryUrl', registryUrl));
            continue;
        }
        validRegistryUrls.push(registryUrl);
        if (parsed.protocol === 'https:') {
            secureHosts.add(parsed.host);
        }
        else {
            insecureHosts.add(parsed.host);
        }
    }
    for (const host of secureHosts) {
        if (insecureHosts.has(host)) {
            throw new Error(tl.loc('Error_MixedRegistrySchemes', host));
        }
    }
    return validRegistryUrls;
}
function normalizeRegistry(registryUrl) {
    if (registryUrl && !registryUrl.endsWith('/')) {
        registryUrl += '/';
    }
    return registryUrl;
}
// Convert a registry URL to nerf-dart form (//host/path/) for matching
// registry entries and formatting .npmrc auth keys.
function toNerfDart(registryUrl) {
    const parsed = new URL(registryUrl);
    const host = (parsed.host || '').toLowerCase();
    let pathname = parsed.pathname || '/';
    if (!pathname.endsWith('/')) {
        pathname += '/';
    }
    return `//${host}${pathname}`;
}
function validateNpmrcPath() {
    const npmrcPath = tl.getInput(constants.NpmAuthenticateTaskInput.WorkingFile);
    if (!npmrcPath.endsWith('.npmrc')) {
        throw new Error(tl.loc('NpmrcNotNpmrc', npmrcPath));
    }
    if (!tl.exist(npmrcPath)) {
        throw new Error(tl.loc('NpmrcDoesNotExist', npmrcPath));
    }
    console.log(tl.loc('AuthenticatingThisNpmrc', npmrcPath));
    return npmrcPath;
}
function getPreviouslyAuthenticatedUrls() {
    return tl.getVariable('EXISTING_ENDPOINTS')
        ? tl.getVariable('EXISTING_ENDPOINTS').split(',')
        : [];
}
function initializeBackupDirectory() {
    if (tl.getVariable('SAVE_NPMRC_PATH')) {
        return tl.getVariable('SAVE_NPMRC_PATH');
    }
    let tempPath = tl.getVariable('Agent.BuildDirectory') || tl.getVariable('Agent.TempDirectory');
    tempPath = path.join(tempPath, 'npmAuthenticate');
    tl.mkdirP(tempPath);
    const backupDirectory = fs.mkdtempSync(tempPath + path.sep);
    tl.setVariable('SAVE_NPMRC_PATH', backupDirectory, false);
    tl.setVariable('NPM_AUTHENTICATE_TEMP_DIRECTORY', tempPath, false);
    return backupDirectory;
}
function resolvePackagingLocation() {
    return __awaiter(this, void 0, void 0, function* () {
        return yield pkgLocationUtils.getPackagingUris(pkgLocationUtils.ProtocolType.Npm);
    });
}
// Discovers registries from the .npmrc that match packaging service hosts,
// and generates auth tokens for them using System.AccessToken.
function resolveInternalFeedCredentials(npmrc, packagingUris) {
    if (!fs.existsSync(npmrc)) {
        return [];
    }
    const packagingOrigins = packagingUris
        .map(uri => {
        try {
            const parsedUri = new URL(uri);
            return parsedUri.protocol === 'https:' ? parsedUri.origin : undefined;
        }
        catch (_a) {
            return undefined;
        }
    })
        .filter((origin) => origin !== undefined && origin !== 'null');
    const allRegistries = getRegistriesFromNpmrc(npmrc);
    const localRegistries = allRegistries.filter(registryUrl => {
        try {
            const origin = new URL(registryUrl).origin;
            return packagingOrigins.includes(origin);
        }
        catch (_a) {
            return false;
        }
    });
    tl.debug(tl.loc('FoundLocalRegistries', localRegistries.length));
    return localRegistries.map(registryUrl => {
        const nerfed = toNerfDart(registryUrl);
        // SYSTEMVSSCONNECTION is always OAuth — throws if missing.
        const accessToken = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'AccessToken', false);
        tl.setSecret(accessToken);
        tl.debug(tl.loc('FoundBuildCredentials'));
        return {
            url: registryUrl,
            auth: `${nerfed}:_authToken=${accessToken}`
        };
    });
}
function resolveEndpointRegistries(previouslyAuthenticatedUrls) {
    return __awaiter(this, void 0, void 0, function* () {
        const endpointIds = tl.getDelimitedInput(constants.NpmAuthenticateTaskInput.CustomEndpoint, ',');
        if (!endpointIds || endpointIds.length === 0) {
            return [];
        }
        const registries = [];
        yield Promise.all(endpointIds.map((endpointId) => __awaiter(this, void 0, void 0, function* () {
            const credential = yield (0, npmrcCredential_1.resolveServiceEndpointCredential)(endpointId, normalizeRegistry, toNerfDart);
            if (previouslyAuthenticatedUrls.indexOf(credential.url) !== -1) {
                tl.warning(tl.loc('DuplicateCredentials', credential.url));
            }
            else {
                previouslyAuthenticatedUrls.push(credential.url);
                tl.setVariable('EXISTING_ENDPOINTS', previouslyAuthenticatedUrls.join(','), false);
            }
            registries.push(credential);
        })));
        return registries;
    });
}
function tryResolveFromEndpoints(registryUrlString, endpointRegistries) {
    for (const endpoint of endpointRegistries) {
        if (new URL(endpoint.url).origin === new URL(registryUrlString).origin
            && toNerfDart(endpoint.url) === toNerfDart(registryUrlString)) {
            return endpoint;
        }
    }
    return null;
}
function tryResolveFromLocalRegistries(registryUrlString, localRegistries, previouslyAuthenticatedUrls, registryHost) {
    for (const localRegistry of localRegistries) {
        if (new URL(localRegistry.url).origin === new URL(registryUrlString).origin
            && toNerfDart(localRegistry.url) === toNerfDart(registryUrlString)) {
            if (previouslyAuthenticatedUrls.indexOf(localRegistry.url) !== -1) {
                tl.warning(tl.loc('DuplicateCredentials', localRegistry.url));
                tl.warning(tl.loc('FoundEndpointCredentials', registryHost));
            }
            return localRegistry;
        }
    }
    return null;
}
function getRegistriesFromNpmrc(npmrcPath) {
    if (!fs.existsSync(npmrcPath)) {
        tl.warning(tl.loc('Warning_NpmrcFileNotFound', npmrcPath));
        return [];
    }
    const config = ini.parse(fs.readFileSync(npmrcPath).toString());
    const registries = [];
    for (const key in config) {
        const colonIndex = key.indexOf(':');
        if (key.substring(colonIndex + 1).toLowerCase() === 'registry') {
            config[key] = normalizeRegistry(config[key]);
            registries.push(config[key]);
        }
    }
    // Write normalized URLs back so downstream npm/yarn sees trailing slashes.
    tl.writeFile(npmrcPath, ini.stringify(config));
    return registries;
}
function appendAuthToNpmrc(npmrcPath, authEntry) {
    fs.appendFileSync(npmrcPath, os.EOL + authEntry + os.EOL);
    tl.debug(tl.loc('SuccessfulAppend'));
}
function removeExistingCredentialEntries(npmrcPath, lines, registryUrl, addedRegistryUrls) {
    let warned = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const referencesHost = line.indexOf(registryUrl.host) !== -1;
        const referencesPath = line.indexOf(registryUrl.pathname) !== -1;
        const isRegistryLine = line.indexOf('registry=') !== -1;
        if (referencesHost && referencesPath && !isRegistryLine) {
            // Suppress the warning if we've already added auth for this exact
            // registry (e.g., same URL appears as both registry= and @scope:registry=).
            const isRegistryAlreadyAdded = addedRegistryUrls.some(url => url !== registryUrl && toNerfDart(url.href) === toNerfDart(registryUrl.href));
            if (!warned && !isRegistryAlreadyAdded) {
                tl.warning(tl.loc('CheckedInCredentialsOverriden', registryUrl.host));
            }
            warned = true;
            lines[i] = '';
        }
    }
    fs.writeFileSync(npmrcPath, lines.join(os.EOL));
    return lines;
}
function getAzureDevOpsServiceConnectionCredentials(adoServiceConnection, feedUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        const credentials = yield (0, EntraWifUserServiceConnectionUtils_1.getFederatedWorkloadIdentityCredentialsForFeed)(adoServiceConnection, (0, feedUrlUtils_1.parseAzureArtifactsFeedUrl)(feedUrl), protocols_1.ProtocolType.Npm);
        if (!credentials) {
            throw new Error(tl.loc('FailedToGetServiceConnectionAuth', adoServiceConnection));
        }
        return credentials;
    });
}
