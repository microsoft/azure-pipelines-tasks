import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as toml from 'toml';
import * as fs from 'fs';
import * as constants from './constants';
import * as base64 from 'base-64';
import * as utf8 from 'utf8';
import { ServiceConnection, getPackagingServiceConnections, ServiceConnectionAuthType, UsernamePasswordServiceConnection, TokenServiceConnection } from "azure-pipelines-tasks-artifacts-common/serviceConnectionUtils";
import { verifyAzureArtifactsFeedUrl } from "azure-pipelines-tasks-artifacts-common/feedUrlUtils";
import { ProtocolType } from "azure-pipelines-tasks-artifacts-common/protocols";
import { getFederatedWorkloadIdentityCredentialsForFeed } from "azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils";
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
        const configtoml = tl.getInput(constants.CargoAuthenticateTaskInput.ConfigFile);
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
        const configtomlFile = fs.readFileSync(configtoml, 'utf8');
        const result = toml.parse(configtomlFile);
        if (!result.registries)
        {
            throw new Error(tl.loc('ConfigTomlMissingRegistry'));
        }

        const registriesInfo = getRegistriesInfo(result.registries);
        validateRegistryEnvKeyCollisions(registriesInfo);

        const registries = tl.getInput("registryNames");
        const entraWifServiceConnectionName = tl.getInput("workloadIdentityServiceConnection");

        if (entraWifServiceConnectionName && registries) {
            const registryNames = registries.split(',');

            for (const registryName of registryNames) {
                if(!result.registries[registryName]) {
                    throw new Error(tl.loc("RegistryNotFound", registryName));
                }
            }

            const selectedRegistriesInfo = registriesInfo.filter(registry => registryNames.includes(registry.name));
            for (const registryInfo of selectedRegistriesInfo)
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

        const localAccesstoken = `Bearer ${tl.getVariable('System.AccessToken')}`;
        const serviceConnections = getPackagingServiceConnections('cargoServiceConnections');
        const externalServiceConnections: ServiceConnection[] = [];

        for (const serviceConnection of serviceConnections) {
            switch (serviceConnection.authType) {
                case (ServiceConnectionAuthType.UsernamePassword):
                    externalServiceConnections.push(serviceConnection);
                    break;
                case (ServiceConnectionAuthType.Token):
                    // We only support crates.io
                    if (!isCratesIoUri(serviceConnection.packageSource.uri)) 
                        throw Error(tl.loc('Error_InvalidServiceConnection', serviceConnection.packageSource.uri));

                    const tokenAuthInfo = serviceConnection as TokenServiceConnection;
                    tl.debug(`Detected token credentials for '${serviceConnection.packageSource.uri}'`);
                    setSecretEnvVariable("CARGO_REGISTRY_TOKEN", tokenAuthInfo.token);
                    tl.setVariable("CARGO_REGISTRY_CREDENTIAL_PROVIDER", "cargo:token");
                    break;
                default:
                    throw Error(tl.loc('Error_InvalidServiceConnection', serviceConnection.packageSource.uri));
            }
        }

        for (const registryInfo of registriesInfo) {
            const verifiedRegistryUrl = await tryVerifyRegistryUrl(registryInfo.urlString);
            if (!verifiedRegistryUrl) {
                warnRegistrySkipped(registryInfo);
                continue;
            }

            let authenticatedExternally = false;
            for (const serviceConnection of externalServiceConnections) {
                if (normalizeRegistryIndex(serviceConnection.packageSource.uri) !== verifiedRegistryUrl.href) {
                    continue;
                }

                if (tl.getVariable(registryInfo.tokenName)) {
                    tl.warning(tl.loc('ConnectionAlreadySetOverwriting', registryInfo.name, registryInfo.connectionType));
                }
                const usernamePasswordAuthInfo = serviceConnection as UsernamePasswordServiceConnection;
                authenticatedExternally = true;
                tl.debug(`Detected username/password or PAT credentials for '${serviceConnection.packageSource.uri}'`);
                tl.debug(tl.loc('AddingAuthExternalRegistry', registryInfo.name, registryInfo.tokenName));
                setSecretEnvVariable(registryInfo.tokenName, `Basic ${base64.encode(utf8.encode(`${usernamePasswordAuthInfo.username}:${usernamePasswordAuthInfo.password}`))}`);
                tl.setVariable(registryInfo.credProviderName, "cargo:token");
                externalAuthCount++;
            }
            if (authenticatedExternally) {
                continue;
            }

            if (tl.getVariable(registryInfo.tokenName)) {
                tl.warning(tl.loc('ConnectionAlreadySet', registryInfo.name, registryInfo.connectionType));
                continue;
            }

            tl.debug(tl.loc('AddingAuthRegistry', registryInfo.name, registryInfo.tokenName));
            setSecretEnvVariable(registryInfo.tokenName, localAccesstoken);
            tl.setVariable(registryInfo.credProviderName, "cargo:token");
            internalAuthCount++;
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
function getRegistryAuthStatus(tokenName: string): string{
    let connectionType = '';
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
    const connectionType = getRegistryAuthStatus(tokenName);
    return [tokenName, credProviderName, connectionType] as const;
}

// Cargo resolves hosts with WHATWG rules.
function normalizeRegistryIndex(index: string): string {
    const raw = index.replace(/^sparse\+/, "");
    try {
        return new URL(raw).href;
    } catch {
        return raw;
    }
}

function isCratesIoUri(uri: string): boolean {
    try {
        return new URL(uri).host === "crates.io";
    } catch {
        return false;
    }
}

function getRegistriesInfo(registries: { [name: string]: { index: string } }): RegistryInfo[] {
    return Object.keys(registries).map(name => {
        const urlString = normalizeRegistryIndex(registries[name].index);
        const [tokenName, credProviderName, connectionType] = setRegistryVars(name);
        return { name, urlString, tokenName, credProviderName, connectionType };
    });
}

function validateRegistryEnvKeyCollisions(registriesInfo: RegistryInfo[]): void {
    const registriesByTokenName: { [tokenName: string]: RegistryInfo[] } = {};
    for (const registryInfo of registriesInfo) {
        registriesByTokenName[registryInfo.tokenName] = registriesByTokenName[registryInfo.tokenName] || [];
        registriesByTokenName[registryInfo.tokenName].push(registryInfo);
    }

    for (const tokenName of Object.keys(registriesByTokenName)) {
        const collidingRegistries = registriesByTokenName[tokenName];
        if (collidingRegistries.length > 1) {
            throw new Error(tl.loc('RegistryEnvKeyCollision', collidingRegistries.map(registry => registry.name).join(', '), tokenName));
        }
    }
}

async function tryVerifyRegistryUrl(registryUrl: string): Promise<URL | undefined> {
    try {
        return await verifyAzureArtifactsFeedUrl(registryUrl, ProtocolType.Cargo);
    } catch {
        tl.debug(tl.loc('RegistryFeedVerificationFailed'));
        return undefined;
    }
}

function warnRegistrySkipped(registryInfo: RegistryInfo): void {
    tl.warning(tl.loc('SkippingNonAzureDevOpsRegistry', registryInfo.name, registryInfo.urlString));
}

main();
