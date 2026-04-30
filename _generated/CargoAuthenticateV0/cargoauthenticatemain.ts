import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as toml from 'toml';
import * as fs from 'fs';
import * as constants from './constants';
import * as util from 'azure-pipelines-tasks-packaging-common/util';
import * as pkgLocationUtils from 'azure-pipelines-tasks-packaging-common/locationUtilities';
import * as url from 'url';
import * as base64 from 'base-64';
import * as utf8 from 'utf8';
import { ServiceConnection, getPackagingServiceConnections, ServiceConnectionAuthType, UsernamePasswordServiceConnection, TokenServiceConnection } from "azure-pipelines-tasks-artifacts-common/serviceConnectionUtils";
import { emitTelemetry } from 'azure-pipelines-tasks-artifacts-common/telemetry';

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

        let packagingLocation: pkgLocationUtils.PackagingLocation;
        try {
            packagingLocation = await pkgLocationUtils.getPackagingUris(pkgLocationUtils.ProtocolType.Cargo);
        } catch (error) {
            tl.debug('Unable to get packaging URIs');
            util.logError(error);
            throw error;
        }

        const collectionHosts = packagingLocation.PackagingUris.map((pkgUrl: string) => {
            const parsedUrl = url.parse(pkgUrl);
            if (parsedUrl && parsedUrl.host) {
                return parsedUrl.host.toLowerCase();
            }
            return undefined;
        });


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

        for (let registry of Object.keys(result.registries)) {
            const registryUrlStr = url.parse(result.registries[registry].index.replace("sparse+", "")).href;
            const [registryUrl, tokenName, credProviderName, connectionType] = setRegistryVars(registryUrlStr, registry);

            if (isValidRegistry(registryUrl, collectionHosts, connectionType)) {
                let currentRegistry : string;
                for (let serviceConnection of externalServiceConnections) {
                    if (url.parse(serviceConnection.packageSource.uri).href === registryUrlStr) {
                        if (tl.getVariable(tokenName)) {
                            tl.warning(tl.loc('ConnectionAlreadySetOverwriting', registry, connectionType));
                        };
                        const usernamePasswordAuthInfo = serviceConnection as UsernamePasswordServiceConnection;
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
function setRegistryVars(urlStr: string, registryName: string): readonly [url.UrlWithStringQuery, string, string, string] {
    const registryUrl = url.parse(urlStr);
    const registryConfigName = registryName.toLocaleUpperCase().replace(/-/g, "_");
    const tokenName = `CARGO_REGISTRIES_${registryConfigName}_TOKEN`;
    const credProviderName = `CARGO_REGISTRIES_${registryConfigName}_CREDENTIAL_PROVIDER`;
    const connectionType = getRegistryAuthStatus(tokenName, registryName);
    return [registryUrl, tokenName, credProviderName, connectionType] as const;
}

const isValidRegistry = (registryUrl: url.UrlWithStringQuery, collectionHosts: string[], connectionType: string) => 
    registryUrl && registryUrl.host && collectionHosts.indexOf(registryUrl.host.toLowerCase()) >= 0;

main();
