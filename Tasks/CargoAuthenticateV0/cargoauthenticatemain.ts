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

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, 'task.json'));

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
                    tl.setVariable("CARGO_REGISTRY_TOKEN", tokenAuthInfo.token)
                    break;
                default:
                    throw Error(tl.loc('Error_InvalidServiceConnection', serviceConnection.packageSource.uri));
            }
        }

        for (let registry of Object.keys(result.registries)) {
            const registryUrl = url.parse(result.registries[registry].index);
            let tokenName = `CARGO_REGISTRIES_${registry.toLocaleUpperCase().replace("-", "_")}_TOKEN`;
            if (registryUrl && registryUrl.host && collectionHosts.indexOf(registryUrl.host.toLowerCase()) >= 0) {
                let currentRegistry : string;
                for (let serviceConnection of externalServiceConnections) {
                    if (url.parse(serviceConnection.packageSource.uri).href === url.parse(result.registries[registry].index.replace("sparse+", "")).href) {
                        const usernamePasswordAuthInfo = serviceConnection as UsernamePasswordServiceConnection;
                        currentRegistry = registry;
                        tl.debug(`Detected username/password or PAT credentials for '${serviceConnection.packageSource.uri}'`);
                        tl.debug(tl.loc('AddingAuthExternalRegistry', registry, tokenName));
                        tl.setVariable(tokenName, `Basic ${base64.encode(utf8.encode(`${usernamePasswordAuthInfo.username}:${usernamePasswordAuthInfo.password}`))}`);
                    }      
                }
                // Default to internal registry if no token has been set yet
                if (!currentRegistry) {
                    tl.debug(tl.loc('AddingAuthRegistry', registry, tokenName));
                    tl.setVariable(tokenName, localAccesstoken);
                }  
            }   
        } 
    }

    catch(error) {
        tl.error(error);
        tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToAddAuthentication"));
        return;
    }
}

main();