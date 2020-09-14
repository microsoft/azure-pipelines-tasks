import { ProtocolType } from './protocols';
import { ServiceConnection } from './serviceConnectionUtils';
/**
 * Get the task-provided credential provider plugins directory (containing netcore and netfx folders)
 */
export declare function getTaskCredProviderPluginsDir(): string;
/**
 * Copy the credential provider (netcore and netfx) to the user profile directory
 */
export declare function installCredProviderToUserProfile(overwrite: boolean): Promise<void>;
export declare function getUserProfileNuGetPluginsDir(): string;
/**
 * Configure the credential provider to provide credentials for feeds within the pipeline's organization,
 * as well as for any provided service connections.
 */
export declare function configureCredProvider(protocol: ProtocolType, serviceConnections: ServiceConnection[]): Promise<void>;
/**
 * Configure the credential provider to provide credentials for feeds within the pipeline's organization,
 * using VSS_NUGET_URI_PREFIXES and VSS_NUGET_ACCESSTOKEN variables to do so.
 */
export declare function configureCredProviderForSameOrganizationFeeds(protocol: ProtocolType): Promise<void>;
/**
 * Configure the credential provider to provide credentials for service connections,
 * using VSS_NUGET_EXTERNAL_FEED_ENDPOINTS to do so.
 */
export declare function configureCredProviderForServiceConnectionFeeds(serviceConnections: ServiceConnection[]): void;
/**
 * Build the JSON for VSS_NUGET_EXTERNAL_FEED_ENDPOINTS
 *
 *  Similar to the older NuGetToolRunner2.buildCredentialJson,
 *  but fails hard on ApiKey based service connections instead of silently continuing.
 */
export declare function buildExternalFeedEndpointsJson(serviceConnections: ServiceConnection[]): string;
