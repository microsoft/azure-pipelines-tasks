import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as process from 'process';
import * as tl from 'azure-pipelines-task-lib/task';
import { getConnectionDataForProtocol } from './connectionDataUtils';
import { getPackagingAccessMappings } from './packagingAccessMappingUtils';
import { getSystemAccessToken } from './webapi';
import { ProtocolType } from './protocols';
import { ServiceConnection, ServiceConnectionAuthType, UsernamePasswordServiceConnection, TokenServiceConnection } from './serviceConnectionUtils';
import { retryOnException } from './retryUtils'

tl.setResourcePath(path.join(__dirname , 'module.json'), true);

const CRED_PROVIDER_PREFIX_ENVVAR = "VSS_NUGET_URI_PREFIXES";
const CRED_PROVIDER_ACCESS_TOKEN_ENVVAR = "VSS_NUGET_ACCESSTOKEN";
const CRED_PROVIDER_EXTERNAL_ENDPOINTS_ENVVAR = "VSS_NUGET_EXTERNAL_FEED_ENDPOINTS";

/**
 * An entry in VSS_NUGET_EXTERNAL_FEED_ENDPOINTS
 */
interface EndpointCredentials {
    endpoint: string;
    username?: string;
    password: string;
}

/**
 * The object representing VSS_NUGET_EXTERNAL_FEED_ENDPOINTS
 */
interface EndpointCredentialsContainer {
    endpointCredentials: EndpointCredentials[];
}

/**
 * Get the task-provided credential provider plugins directory (containing netcore and netfx folders)
 */
export function getTaskCredProviderPluginsDir(): string {
    let taskRootPath: string = path.dirname(path.dirname(__dirname));
    return path.join(taskRootPath, "CredentialProviderV2", "plugins");
}


/**
 * Copy the credential provider (netcore and netfx) to the user profile directory
 */
export async function installCredProviderToUserProfile(overwrite: boolean) {
    const taskPluginsPir = getTaskCredProviderPluginsDir();
    const userPluginsDir = getUserProfileNuGetPluginsDir();

    const netCoreSource = path.join(taskPluginsPir, 'netcore', 'CredentialProvider.Microsoft');
    const netCoreDest = path.join(userPluginsDir, 'netcore', 'CredentialProvider.Microsoft');
    console.log(tl.loc("CredProvider_InstallingNetCoreTo", netCoreDest));
    await copyCredProviderFiles(netCoreSource, netCoreDest, overwrite);
    console.log();

    const netFxSource = path.join(taskPluginsPir, 'netfx', 'CredentialProvider.Microsoft');
    const netFxDest = path.join(userPluginsDir, 'netfx', 'CredentialProvider.Microsoft');
    console.log(tl.loc("CredProvider_InstallingNetFxTo", netFxDest));
    await copyCredProviderFiles(netFxSource, netFxDest, overwrite);
    console.log();
}

async function copyCredProviderFiles(source, dest, overwrite) {
    // File copy is potentially unreliable, so retry up to 3 times
    await retryOnException(async () => {
        if (await fse.pathExists(dest) && !overwrite) {
            console.log(tl.loc('CredProvider_AlreadyInstalled'));
            tl.debug(`Skipping copying from '${source}' to '${dest}' because the destination already exists and overwrite is disabled`);
            return;
        }

        // We don't want to risk leaving extra old files in the destination if we're overwriting
        if (overwrite) {
            tl.debug(`Removing '${dest}' before copying from '${source}' since overwrite is enabled`);
            try {
                await fse.remove(dest);
            } catch (ex) {
                throw new Error(tl.loc("CredProvider_Error_FailedRemoveDir", dest) + os.EOL + ex)
            }
        }

        tl.debug(`Copying from '${source}' to '${dest}'`);
        try {
            await fse.copy(source, dest, {
                recursive: true,
                overwrite: false,  // Intentional - if we're overwriting, 
                errorOnExist: true // we should have removed the destination already and there shouldn't be any files
            });
        } catch (ex) {
            throw new Error(tl.loc("CredProvider_Error_FailedCopy", source, dest) + os.EOL + ex)
        }
    }, 3, 1000);
}

export function getUserProfileNuGetPluginsDir(): string {
    const homeDir = os.homedir();
    return path.join(homeDir, ".nuget", "plugins");
}

/**
 * Configure the credential provider to provide credentials for feeds within the pipeline's organization,
 * as well as for any provided service connections.
 */
export async function configureCredProvider(protocol: ProtocolType, serviceConnections: ServiceConnection[]) {
    await configureCredProviderForSameOrganizationFeeds(protocol);
    configureCredProviderForServiceConnectionFeeds(serviceConnections);
}

/**
 * Configure the credential provider to provide credentials for feeds within the pipeline's organization,
 * using VSS_NUGET_URI_PREFIXES and VSS_NUGET_ACCESSTOKEN variables to do so.
 */
export async function configureCredProviderForSameOrganizationFeeds(protocol: ProtocolType) {
    const connectionData = await getConnectionDataForProtocol(protocol);
    const packagingAccessMappings = getPackagingAccessMappings(connectionData.locationServiceData);
    const accessToken = getSystemAccessToken();

    // To avoid confusion, only log the public access mapping URIs rather than all of them (e.g. host guid access mapping)
    // which we might as well support just in case, yet users are extremely unlikely to ever use.
    const allPrefixes: string[] = [...new Set(packagingAccessMappings.map(prefix => prefix.uri))];
    const publicPrefixes: string[] = [...new Set(packagingAccessMappings.filter(prefix => prefix.isPublic).map(prefix => prefix.uri))];
    const identityDisplayName = connectionData.authenticatedUser.customDisplayName || connectionData.authenticatedUser.providerDisplayName;
    console.log(tl.loc('CredProvider_SettingUpForOrgFeeds', identityDisplayName));
    publicPrefixes.forEach(publicPrefix => console.log('  ' + publicPrefix));
    console.log();

    tl.setVariable(CRED_PROVIDER_PREFIX_ENVVAR, allPrefixes.join(";"));
    tl.setVariable(CRED_PROVIDER_ACCESS_TOKEN_ENVVAR, accessToken, false /* while this contains secrets, we need the environment variable to be set */);
}

/**
 * Configure the credential provider to provide credentials for service connections,
 * using VSS_NUGET_EXTERNAL_FEED_ENDPOINTS to do so.
 */
export function configureCredProviderForServiceConnectionFeeds(serviceConnections: ServiceConnection[]) {
    if (serviceConnections && serviceConnections.length) {
        console.log(tl.loc('CredProvider_SettingUpForServiceConnections'));
        // Ideally we'd also show the service connection name, but the agent doesn't expose it :-(
        serviceConnections.map(authInfo => `${authInfo.packageSource.uri}`).forEach(serviceConnectionUri => console.log('  ' + serviceConnectionUri));
        console.log();

        const externalFeedEndpointsJson = buildExternalFeedEndpointsJson(serviceConnections);
        tl.setVariable(CRED_PROVIDER_EXTERNAL_ENDPOINTS_ENVVAR, externalFeedEndpointsJson, false /* while this contains secrets, we need the environment variable to be set */);
    }
}

/**
 * Build the JSON for VSS_NUGET_EXTERNAL_FEED_ENDPOINTS
 * 
 *  Similar to the older NuGetToolRunner2.buildCredentialJson,
 *  but fails hard on ApiKey based service connections instead of silently continuing.
 */
export function buildExternalFeedEndpointsJson(serviceConnections: ServiceConnection[]): string {
    const endpointCredentialsContainer: EndpointCredentialsContainer = {
        endpointCredentials: [] as EndpointCredentials[]
    };

    if (!serviceConnections || !serviceConnections.length) {
        return null;
    }

    serviceConnections.forEach((serviceConnection: ServiceConnection) => {
        switch (serviceConnection.authType) {
            case (ServiceConnectionAuthType.UsernamePassword):
                const usernamePasswordAuthInfo = serviceConnection as UsernamePasswordServiceConnection;
                endpointCredentialsContainer.endpointCredentials.push({
                    endpoint: serviceConnection.packageSource.uri,
                    username: usernamePasswordAuthInfo.username,
                    password: usernamePasswordAuthInfo.password     
                });
                tl.debug(`Detected username/password credentials for '${serviceConnection.packageSource.uri}'`);
                break;
            case (ServiceConnectionAuthType.Token):
                const tokenAuthInfo = serviceConnection as TokenServiceConnection;
                endpointCredentialsContainer.endpointCredentials.push({
                    endpoint: serviceConnection.packageSource.uri,
                    /* No username provided */
                    password: tokenAuthInfo.token
                } as EndpointCredentials);
                tl.debug(`Detected token credentials for '${serviceConnection.packageSource.uri}'`);
                break;
            case (ServiceConnectionAuthType.ApiKey):
                // e.g. ApiKey based service connections are not supported and cause a hard failure in authentication tasks
                const serviceConnectionDisplayText = serviceConnection.packageSource.uri; // Ideally we'd also show the service connection name, but the agent doesn't expose it :-(
                throw Error(tl.loc('CredProvider_Error_InvalidServiceConnection_ApiKey', serviceConnectionDisplayText))
            default:
                throw Error(tl.loc('CredProvider_Error_InvalidServiceConnection'));
        }
    });

    return JSON.stringify(endpointCredentialsContainer);
}