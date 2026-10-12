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
const path = require("path");
const tl = require("azure-pipelines-task-lib/task");
const toml = require("toml");
const fs = require("fs");
const constants = require("./constants");
const util = require("azure-pipelines-tasks-packaging-common/util");
const pkgLocationUtils = require("azure-pipelines-tasks-packaging-common/locationUtilities");
const url = require("url");
const base64 = require("base-64");
const utf8 = require("utf8");
const serviceConnectionUtils_1 = require("azure-pipelines-tasks-artifacts-common/serviceConnectionUtils");
const EntraWifUserServiceConnectionUtils_1 = require("azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils");
const feedUrlUtils_1 = require("azure-pipelines-tasks-artifacts-common/feedUrlUtils");
const telemetry_1 = require("azure-pipelines-tasks-artifacts-common/telemetry");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        tl.setResourcePath(path.join(__dirname, 'task.json'));
        let internalAuthCount = 0;
        let externalAuthCount = 0;
        let federatedAuthCount = 0;
        try {
            let configtoml = tl.getInput(constants.CargoAuthenticateTaskInput.ConfigFile);
            if (!tl.exist(configtoml)) {
                throw new Error(tl.loc('ConfigTomlDoesNotExist', configtoml));
            }
            else {
                console.log(tl.loc("AuthenticatingThisConfigToml", configtoml));
            }
            // These two formats will work
            // [registries]
            // zhentan-test = { index = "sparse+https://pkgs.dev.azure.com/codesharing-SU0/zhentan-test/_packaging/zhentan-test/Cargo/index/" }
            // [registries.zhentan-test1]
            // index = "sparse+https://pkgs.dev.azure.com/codesharing-SU0/zhentan-test/_packaging/zhentan-test/Cargo/index/"
            let configtomlFile = fs.readFileSync(configtoml, 'utf8');
            var result = toml.parse(configtomlFile);
            if (!result.registries) {
                throw new Error(tl.loc('ConfigTomlMissingRegistry'));
            }
            let packagingLocation;
            try {
                packagingLocation = yield pkgLocationUtils.getPackagingUris(pkgLocationUtils.ProtocolType.Cargo);
            }
            catch (error) {
                tl.debug('Unable to get packaging URIs');
                util.logError(error);
                throw error;
            }
            const collectionHosts = packagingLocation.PackagingUris.map((pkgUrl) => {
                const parsedUrl = url.parse(pkgUrl);
                if (parsedUrl && parsedUrl.host) {
                    return parsedUrl.host.toLowerCase();
                }
                return undefined;
            });
            const registries = tl.getInput("registryNames");
            const entraWifServiceConnectionName = tl.getInput("workloadIdentityServiceConnection");
            if (entraWifServiceConnectionName && registries) {
                const registryNames = registries.split(',');
                for (let registryName of registryNames) {
                    if (!result.registries[registryName]) {
                        throw new Error(tl.loc("RegistryNotFound", registryName));
                    }
                }
                const registriesInfo = Object.entries(result.registries).filter(registry => registryNames.includes(registry[0]));
                for (let registryInfo of registriesInfo) {
                    var registryUrlStr = url.parse(registryInfo[1].index.replace("sparse+", "")).href;
                    const credentials = yield (0, EntraWifUserServiceConnectionUtils_1.getFederatedWorkloadIdentityCredentialsForFeed)(entraWifServiceConnectionName, (0, feedUrlUtils_1.parseAzureArtifactsFeedUrl)(registryUrlStr));
                    if (!credentials) {
                        throw new Error(tl.loc("FailedToGetServiceConnectionAuth", entraWifServiceConnectionName));
                    }
                    const [, tokenName, credProviderName, connectionType] = setRegistryVars(credentials.feedUrl.href, registryInfo[0]);
                    if (tl.getVariable(tokenName)) {
                        tl.warning(tl.loc('ConnectionAlreadySetOverwriting', registryInfo[0], connectionType));
                    }
                    setSecretEnvVariable(tokenName, `Basic ${base64.encode(utf8.encode(`${entraWifServiceConnectionName}:${credentials.accessToken}`))}`);
                    tl.setVariable(credProviderName, "cargo:token");
                    federatedAuthCount++;
                }
                return;
            }
            else if (entraWifServiceConnectionName || registries) {
                throw new Error(tl.loc("MissingRegistryNameOrServiceConnection"));
            }
            const localAccesstoken = `Bearer ${tl.getVariable('System.AccessToken')}`;
            const serviceConnections = (0, serviceConnectionUtils_1.getPackagingServiceConnections)('cargoServiceConnections');
            let externalServiceConnections = [];
            for (let serviceConnection of serviceConnections) {
                switch (serviceConnection.authType) {
                    case (serviceConnectionUtils_1.ServiceConnectionAuthType.UsernamePassword):
                        externalServiceConnections.push(serviceConnection);
                        break;
                    case (serviceConnectionUtils_1.ServiceConnectionAuthType.Token):
                        // We only support crates.io
                        if (url.parse(serviceConnection.packageSource.uri).host !== "crates.io")
                            throw Error(tl.loc('Error_InvalidServiceConnection', serviceConnection.packageSource.uri));
                        const tokenAuthInfo = serviceConnection;
                        tl.debug(`Detected token credentials for '${serviceConnection.packageSource.uri}'`);
                        setSecretEnvVariable("CARGO_REGISTRY_TOKEN", tokenAuthInfo.token);
                        tl.setVariable("CARGO_REGISTRY_CREDENTIAL_PROVIDER", "cargo:token");
                        break;
                    default:
                        throw Error(tl.loc('Error_InvalidServiceConnection', serviceConnection.packageSource.uri));
                }
            }
            for (let registry of Object.keys(result.registries)) {
                const registryUrlStr = url.parse(result.registries[registry].index.replace("sparse+", "")).href;
                const [registryUrl, tokenName, credProviderName, connectionType] = setRegistryVars(registryUrlStr, registry);
                if (isValidRegistry(registryUrl, collectionHosts, connectionType)) {
                    let currentRegistry;
                    for (let serviceConnection of externalServiceConnections) {
                        if (url.parse(serviceConnection.packageSource.uri).href === registryUrlStr) {
                            if (tl.getVariable(tokenName)) {
                                tl.warning(tl.loc('ConnectionAlreadySetOverwriting', registry, connectionType));
                            }
                            ;
                            const usernamePasswordAuthInfo = serviceConnection;
                            currentRegistry = registry;
                            tl.debug(`Detected username/password or PAT credentials for '${serviceConnection.packageSource.uri}'`);
                            tl.debug(tl.loc('AddingAuthExternalRegistry', registry, tokenName));
                            setSecretEnvVariable(tokenName, `Basic ${base64.encode(utf8.encode(`${usernamePasswordAuthInfo.username}:${usernamePasswordAuthInfo.password}`))}`);
                            tl.setVariable(credProviderName, "cargo:token");
                            externalAuthCount++;
                        }
                    }
                    // Default to internal registry if no token has been set yet, warn if token is already set
                    if (!currentRegistry && !tl.getVariable(tokenName)) {
                        tl.debug(tl.loc('AddingAuthRegistry', registry, tokenName));
                        setSecretEnvVariable(tokenName, localAccesstoken);
                        tl.setVariable(credProviderName, "cargo:token");
                        internalAuthCount++;
                    }
                    else if (!currentRegistry && tl.getVariable(tokenName)) {
                        tl.warning(tl.loc('ConnectionAlreadySet', registry, connectionType));
                    }
                }
            }
        }
        catch (error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToAddAuthentication"));
            return;
        }
        finally {
            console.log(tl.loc("AuthTelemetry", internalAuthCount, externalAuthCount, federatedAuthCount));
            (0, telemetry_1.emitTelemetry)("Packaging", "CargoAuthenticateV0", {
                "InternalFeedAuthCount": internalAuthCount,
                "ExternalFeedAuthCount": externalAuthCount,
                "FederatedConnectionAuthCount": federatedAuthCount
            });
        }
    });
}
// Register the value as a secret to the logger before setting the value in an environment variable.
// Use when needed to set a specific environment variable whose value is a secret. We cannot use 
// setVariable(_, , isSecret=true) because it adds SECRET_ as a prefix to the env variable.
function setSecretEnvVariable(variableName, value) {
    tl.setSecret(value);
    tl.setVariable(variableName, value);
}
// Informs on whether a registry was authenticated already, and if so says if it's an internal or external connection
function getRegistryAuthStatus(tokenName, registryName) {
    let connectionType = '';
    if (tl.getVariable(tokenName)) {
        connectionType = tl.getVariable(tokenName).indexOf('Basic') !== -1 ? 'external or federated' : 'internal';
    }
    return connectionType;
}
// Sets variables later needed for authenticating registries
function setRegistryVars(urlStr, registryName) {
    const registryUrl = url.parse(urlStr);
    const registryConfigName = registryName.toLocaleUpperCase().replace(/-/g, "_");
    const tokenName = `CARGO_REGISTRIES_${registryConfigName}_TOKEN`;
    const credProviderName = `CARGO_REGISTRIES_${registryConfigName}_CREDENTIAL_PROVIDER`;
    const connectionType = getRegistryAuthStatus(tokenName, registryName);
    return [registryUrl, tokenName, credProviderName, connectionType];
}
const isValidRegistry = (registryUrl, collectionHosts, connectionType) => registryUrl &&
    registryUrl.protocol === "https:" &&
    registryUrl.host &&
    collectionHosts.indexOf(registryUrl.host.toLowerCase()) >= 0;
main();
