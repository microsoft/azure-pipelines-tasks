import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as toml from 'toml';
import * as fs from 'fs';
import * as constants from './constants';
import * as url from 'url';
import * as base64 from 'base-64';
import * as utf8 from 'utf8';
import { ServiceConnection, getPackagingServiceConnections, ServiceConnectionAuthType, UsernamePasswordServiceConnection, TokenServiceConnection } from "azure-pipelines-tasks-artifacts-common/serviceConnectionUtils";
import { verifyAzureArtifactsFeedUrl } from "azure-pipelines-tasks-artifacts-common/feedUrlUtils";
import { ProtocolType } from "azure-pipelines-tasks-artifacts-common/protocols";
#if WIF
import { getFederatedWorkloadIdentityCredentialsForFeed } from "azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils";
#endif
import { emitTelemetry } from 'azure-pipelines-tasks-artifacts-common/telemetry';

interface RegistryInfo {
    name: string;
    urlString: string;
    tokenName: string;
    credProviderName: string;
    connectionType: string;
}

async function main(): Promise<void> {
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
        if (!result.registries)
        {
            throw new Error(tl.loc('ConfigTomlMissingRegistry'));
        }

        const registriesInfo = getRegistriesInfo(result.registries);
        validateRegistryEnvKeyCollisions(registriesInfo);

#if WIF
        const registries = tl.getInput("registryNames");
        const entraWifServiceConnectionName = tl.getInput("workloadIdentityServiceConnection");

        if (entraWifServiceConnectionName && registries) {
            const registryNames = registries.split(',');

            for (let registryName of registryNames) {
                if(!result.registries[registryName]) {
                    throw new Error(tl.loc("RegistryNotFound", registryName));
                }
            }

            const selectedRegistriesInfo = registriesInfo.filter(registry => registryNames.includes(registry.name));
            for (let registryInfo of selectedRegistriesInfo)
            {
                const credentials = await getFederatedWorkloadIdentityCredentialsForFeed(
                    entraWifServiceConnectionName,
                    registryInfo.urlString,
                    ProtocolType.Cargo);
                if (!credentials) {
                    throw new Error(tl.loc("FailedToGetServiceConnectionAuth", entraWifServiceConnectionName));
                }

                if (tl.getVariable(registryInfo.tokenName)) {
                    tl.warning(tl.loc('ConnectionAlreadySetOverwriting', registryInfo.name, registryInfo.connectionType));
                }

                setSecretEnvVariable(
                    registryInfo.tokenName,
                    `Basic ${base64.encode(utf8.encode(`${entraWifServiceConnectionName}:${credentials.accessToken}`))}`);
                tl.setVariable(registryInfo.credProviderName, "cargo:token");
                federatedAuthCount++;
            }

            return;
        }
        else if (entraWifServiceConnectionName || registries) {
            throw new Error(tl.loc("MissingRegistryNameOrServiceConnection"));
        }
#endif

        const localAccesstoken = `Bearer ${tl.getVariable('System.AccessToken')}`;
        const serviceConnections = getPackagingServiceConnections('cargoServiceConnections');
        let externalServiceConnections: ServiceConnection[] = [];

        for (let serviceConnection of serviceConnections) {
            switch (serviceConnection.authType) {
                case (ServiceConnectionAuthType.UsernamePassword):
                    externalServiceConnections.push(serviceConnection);
                    break;
                case (ServiceConnectionAuthType.Token):
                    // We only support crates.io
                    if (url.parse(serviceConnection.packageSource.uri).host !== "crates.io") throw Error(tl.loc('Error_InvalidServiceConnection', serviceConnection.packageSource.uri));

                    const tokenAuthInfo = serviceConnection as TokenServiceConnection;
                    tl.debug(`Detected token credentials for '${serviceConnection.packageSource.uri}'`);
                    setSecretEnvVariable("CARGO_REGISTRY_TOKEN", tokenAuthInfo.token);
                    tl.setVariable("CARGO_REGISTRY_CREDENTIAL_PROVIDER", "cargo:token");
                    break;
                default:
                    throw Error(tl.loc('Error_InvalidServiceConnection', serviceConnection.packageSource.uri));
            }
        }

        for (let registryInfo of registriesInfo) {
            const verifiedRegistryUrl = await tryVerifyRegistryUrl(registryInfo.urlString);
            if (verifiedRegistryUrl) {
                let currentRegistry : string;
                for (let serviceConnection of externalServiceConnections) {
                    if (url.parse(serviceConnection.packageSource.uri).href === verifiedRegistryUrl.href) {
                        if (tl.getVariable(registryInfo.tokenName)) {
                            tl.warning(tl.loc('ConnectionAlreadySetOverwriting', registryInfo.name, registryInfo.connectionType));
                        };
                        const usernamePasswordAuthInfo = serviceConnection as UsernamePasswordServiceConnection;
                        currentRegistry = registryInfo.name;
                        tl.debug(`Detected username/password or PAT credentials for '${serviceConnection.packageSource.uri}'`);
                        tl.debug(tl.loc('AddingAuthExternalRegistry', registryInfo.name, registryInfo.tokenName));
                        setSecretEnvVariable(registryInfo.tokenName, `Basic ${base64.encode(utf8.encode(`${usernamePasswordAuthInfo.username}:${usernamePasswordAuthInfo.password}`))}`);
                        tl.setVariable(registryInfo.credProviderName, "cargo:token");
                        externalAuthCount++;
                    }      
                }
                // Default to internal registry if no token has been set yet, warn if token is already set
                if (!currentRegistry && !tl.getVariable(registryInfo.tokenName)) {
                    tl.debug(tl.loc('AddingAuthRegistry', registryInfo.name, registryInfo.tokenName));
                    setSecretEnvVariable(registryInfo.tokenName, localAccesstoken);
                    tl.setVariable(registryInfo.credProviderName, "cargo:token");
                    internalAuthCount++;
                }  
                else if (!currentRegistry && tl.getVariable(registryInfo.tokenName)) {
                    tl.warning(tl.loc('ConnectionAlreadySet', registryInfo.name, registryInfo.connectionType));
                } 
            }
            else {
                warnRegistrySkipped(registryInfo);
            }
        }
    }

    catch(error) {
        tl.error(error);
        tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToAddAuthentication"));
        return;
    }

    finally {
        console.log(tl.loc("AuthTelemetry", internalAuthCount, externalAuthCount, federatedAuthCount));
        emitTelemetry("Packaging", "CargoAuthenticateV0", {
            "InternalFeedAuthCount": internalAuthCount,
            "ExternalFeedAuthCount": externalAuthCount,
            "FederatedConnectionAuthCount": federatedAuthCount
        });
    }
}

// Register the value as a secret to the logger before setting the value in an environment variable.
// Use when needed to set a specific environment variable whose value is a secret. We cannot use 
// setVariable(_, , isSecret=true) because it adds SECRET_ as a prefix to the env variable.
function setSecretEnvVariable(variableName: string, value: string){
    tl.setSecret(value);
    tl.setVariable(variableName, value);
}

// Informs on whether a registry was authenticated already, and if so says if it's an internal or external connection
function getRegistryAuthStatus(tokenName: string, registryName: string): string{
    let connectionType = ''
    if (tl.getVariable(tokenName)) {
        connectionType = tl.getVariable(tokenName).indexOf('Basic') !== -1 ? 'external or federated' : 'internal';
    }
    return connectionType;
}

// Sets variables later needed for authenticating registries
function setRegistryVars(registryName: string): readonly [string, string, string] {
    const registryConfigName = registryName.toUpperCase().replace(/-/g, "_");
    const tokenName = `CARGO_REGISTRIES_${registryConfigName}_TOKEN`;
    const credProviderName = `CARGO_REGISTRIES_${registryConfigName}_CREDENTIAL_PROVIDER`;
    const connectionType = getRegistryAuthStatus(tokenName, registryName);
    return [tokenName, credProviderName, connectionType] as const;
}

function getRegistriesInfo(registries: { [name: string]: { index: string } }): RegistryInfo[] {
    return Object.keys(registries).map(name => {
        const urlString = url.parse(registries[name].index.replace("sparse+", "")).href;
        const [tokenName, credProviderName, connectionType] = setRegistryVars(name);
        return { name, urlString, tokenName, credProviderName, connectionType };
    });
}

function validateRegistryEnvKeyCollisions(registriesInfo: RegistryInfo[]): void {
    const registriesByTokenName: { [tokenName: string]: RegistryInfo[] } = {};
    for (let registryInfo of registriesInfo) {
        registriesByTokenName[registryInfo.tokenName] = registriesByTokenName[registryInfo.tokenName] || [];
        registriesByTokenName[registryInfo.tokenName].push(registryInfo);
    }

    for (let tokenName of Object.keys(registriesByTokenName)) {
        const collidingRegistries = registriesByTokenName[tokenName];
        if (collidingRegistries.length > 1) {
            throw new Error(tl.loc('RegistryEnvKeyCollision', collidingRegistries.map(registry => registry.name).join(', '), tokenName));
        }
    }
}

async function tryVerifyRegistryUrl(registryUrl: string): Promise<URL | undefined> {
    try {
        return await verifyAzureArtifactsFeedUrl(registryUrl, ProtocolType.Cargo);
    } catch (error) {
        if (!isFeedValidationError(error)) {
            throw error;
        }
        return undefined;
    }
}

function isFeedValidationError(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }

    return [
        "Error_FeedUrlUntrustedHost",
        "Error_UrlCredentialsNotAllowed",
        "Error_UrlHttpsRequired",
        "Error_UrlInvalid"
    ].some(resourceKey =>
        error.message === resourceKey || error.message === tl.loc(resourceKey)
    );
}

function warnRegistrySkipped(registryInfo: RegistryInfo): void {
    tl.warning(tl.loc('SkippingNonAzureDevOpsRegistry', registryInfo.name, registryInfo.urlString));
}

main();
