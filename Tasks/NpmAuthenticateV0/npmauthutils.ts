import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as os from 'os';
import {
    NpmAuthenticateTaskInput,
    NpmConfigFileState,
    NpmConfigState,
    NpmConfigTelemetryPhase
} from './constants';
import * as ini from 'ini';
import * as pkgLocationUtils from 'azure-pipelines-tasks-packaging-common/locationUtilities';
import { resolveServiceEndpointCredential, NpmrcCredential } from './npmrcCredential';
import { emitTelemetry } from 'azure-pipelines-tasks-artifacts-common/telemetry';
#if WIF
import { getFederatedWorkloadIdentityCredentials } from 'azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils';
#endif

function getAbsoluteFilePath(filePath: string, homeDirectory: string | undefined): string | undefined {
    const isHomeRelative = filePath.startsWith('~/')
        || (process.platform === 'win32' && filePath.startsWith('~\\'));
    if (isHomeRelative) {
        if (!homeDirectory) {
            return undefined;
        }
        return path.resolve(homeDirectory, filePath.slice(2));
    }

    return path.resolve(filePath);
}

function areFilePathsEqual(firstFilePath: string, secondFilePath: string): boolean {
    if (process.platform === 'win32') {
        return firstFilePath.toLowerCase() === secondFilePath.toLowerCase();
    }

    return firstFilePath === secondFilePath;
}

function getNpmConfigFileState(filePath: string): NpmConfigFileState {
    try {
        // Inspect the target's file metadata, following links without reading file contents.
        const stats = fs.statSync(filePath);
        return stats.isFile() ? NpmConfigFileState.ExistingFile : NpmConfigFileState.InvalidPath;
    } catch (error) {
        const errorCode = error instanceof Error && 'code' in error ? error.code : undefined;
        if (errorCode === 'ENOENT') {
            return NpmConfigFileState.MissingFile;
        }
        if (errorCode === 'ENOTDIR') {
            return NpmConfigFileState.InvalidPath;
        }
        return NpmConfigFileState.Unknown;
    }
}

export function emitNpmConfigTelemetry(phase: NpmConfigTelemetryPhase): void {
    try {
        // Observe the agent account's default user config independently of the override.
        let homeDirectory: string | undefined = undefined;
        try {
            homeDirectory = os.homedir();
        } catch {
        }
        const defaultUserFilePath = homeDirectory ? path.resolve(homeDirectory, '.npmrc') : undefined;

        // Prefer uppercase when present, preserving the distinction between empty and unset.
        const userConfigEnvValue = process.env.NPM_CONFIG_USERCONFIG !== undefined
            ? process.env.NPM_CONFIG_USERCONFIG : process.env.npm_config_userconfig;
        let userConfigEnvVarState = NpmConfigState.Unset;
        let userConfigEnvVarFileState = NpmConfigFileState.NotApplicable;

        const defaultUserFileState = defaultUserFilePath
            ? getNpmConfigFileState(defaultUserFilePath) : NpmConfigFileState.Unknown;

        if (userConfigEnvValue !== undefined) {
            if (userConfigEnvValue === '') {
                userConfigEnvVarState = NpmConfigState.Empty;
            } else {
                userConfigEnvVarState = NpmConfigState.Unknown;
                userConfigEnvVarFileState = NpmConfigFileState.Unknown;

                try {
                    const absoluteUserConfigFilePath = getAbsoluteFilePath(userConfigEnvValue, homeDirectory);
                    if (absoluteUserConfigFilePath !== undefined) {
                        const isDefaultUserFilePath = defaultUserFilePath !== undefined
                            && areFilePathsEqual(absoluteUserConfigFilePath, defaultUserFilePath);
                        if (defaultUserFilePath) {
                            userConfigEnvVarState = isDefaultUserFilePath
                                ? NpmConfigState.SetAsDefault : NpmConfigState.Set;
                        }

                        userConfigEnvVarFileState = isDefaultUserFilePath
                            ? defaultUserFileState : getNpmConfigFileState(absoluteUserConfigFilePath);
                    }
                } catch {
                    // Retain unknown states when the override path cannot be interpreted.
                }
            }
        }

        // Publish only categorical observations, never paths or config contents.
        emitTelemetry('Packaging', 'NpmAuthenticateV0Config', {
            Phase: phase,
            UserConfigEnvVarState: userConfigEnvVarState,
            UserConfigEnvVarFileState: userConfigEnvVarFileState,
            DefaultUserFileState: defaultUserFileState
        });
    } catch {
        // Telemetry failures must not affect authentication or cleanup.
    }
}

export function validateAndFilterRegistryUrls(registryUrls: string[]): string[] {
    const secureHosts = new Set<string>();
    const insecureHosts = new Set<string>();
    const validRegistryUrls: string[] = [];
    for (const registryUrl of registryUrls) {
        let parsed: URL;
        try {
            parsed = new URL(registryUrl);
        } catch {
            console.log(tl.loc('InvalidRegistryUrl', registryUrl));
            continue;
        }
        validRegistryUrls.push(registryUrl);
        if (parsed.protocol === 'https:') {
            secureHosts.add(parsed.host);
        } else {
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

export function normalizeRegistry(registryUrl: string): string {
    if (registryUrl && !registryUrl.endsWith('/')) {
        registryUrl += '/';
    }
    return registryUrl;
}

// Convert a registry URL to nerf-dart form (//host/path/) for matching
// registry entries and formatting .npmrc auth keys.
export function toNerfDart(registryUrl: string): string {
    const parsed = new URL(registryUrl);
    const host = (parsed.host || '').toLowerCase();
    let pathname = parsed.pathname || '/';
    if (!pathname.endsWith('/')) {
        pathname += '/';
    }
    return `//${host}${pathname}`;
}

export function validateNpmrcPath(): string {
    const npmrcPath = tl.getInput(NpmAuthenticateTaskInput.WorkingFile);
    if (!npmrcPath.endsWith('.npmrc')) {
        throw new Error(tl.loc('NpmrcNotNpmrc', npmrcPath));
    }
    if (!tl.exist(npmrcPath)) {
        throw new Error(tl.loc('NpmrcDoesNotExist', npmrcPath));
    }
    console.log(tl.loc('AuthenticatingThisNpmrc', npmrcPath));
    return npmrcPath;
}

export function getPreviouslyAuthenticatedUrls(): string[] {
    return tl.getVariable('EXISTING_ENDPOINTS')
        ? tl.getVariable('EXISTING_ENDPOINTS').split(',')
        : [];
}

export function initializeBackupDirectory(): string {
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

export async function resolvePackagingLocation(): Promise<pkgLocationUtils.PackagingLocation> {
    return await pkgLocationUtils.getPackagingUris(pkgLocationUtils.ProtocolType.Npm);
}

// Discovers registries from the .npmrc that match packaging service hosts,
// and generates auth tokens for them using System.AccessToken.
export function resolveInternalFeedCredentials(
    npmrc: string,
    packagingUris: string[]
): NpmrcCredential[] {
    if (!fs.existsSync(npmrc)) {
        return [];
    }

    const packagingOrigins = packagingUris
        .map(uri => { try { return new URL(uri).origin; } catch { return undefined; } })
        .filter((origin): origin is string => origin !== undefined && origin !== 'null');

    const allRegistries = getRegistriesFromNpmrc(npmrc);
    const localRegistries = allRegistries.filter(registryUrl => {
        try {
            const origin = new URL(registryUrl).origin;
            return packagingOrigins.includes(origin);
        } catch {
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

export async function resolveEndpointRegistries(previouslyAuthenticatedUrls: string[]): Promise<NpmrcCredential[]> {
    const endpointIds = tl.getDelimitedInput(NpmAuthenticateTaskInput.CustomEndpoint, ',');
    if (!endpointIds || endpointIds.length === 0) {
        return [];
    }

    const registries: NpmrcCredential[] = [];
    await Promise.all(endpointIds.map(async (endpointId) => {
        const credential = await resolveServiceEndpointCredential(endpointId, normalizeRegistry, toNerfDart);
        if (previouslyAuthenticatedUrls.indexOf(credential.url) !== -1) {
            tl.warning(tl.loc('DuplicateCredentials', credential.url));
        } else {
            previouslyAuthenticatedUrls.push(credential.url);
            tl.setVariable('EXISTING_ENDPOINTS', previouslyAuthenticatedUrls.join(','), false);
        }
        registries.push(credential);
    }));
    return registries;
}

export function tryResolveFromEndpoints(
    registryUrlString: string,
    endpointRegistries: NpmrcCredential[]
): NpmrcCredential | null {
    for (const endpoint of endpointRegistries) {
        if (new URL(endpoint.url).origin === new URL(registryUrlString).origin
            && toNerfDart(endpoint.url) === toNerfDart(registryUrlString)) {
            return endpoint;
        }
    }
    return null;
}

export function tryResolveFromLocalRegistries(
    registryUrlString: string,
    localRegistries: NpmrcCredential[],
    previouslyAuthenticatedUrls: string[],
    registryHost: string
): NpmrcCredential | null {
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

export function getRegistriesFromNpmrc(npmrcPath: string): string[] {
    if (!fs.existsSync(npmrcPath)) {
        tl.warning(tl.loc('Warning_NpmrcFileNotFound', npmrcPath));
        return [];
    }

    const config = ini.parse(fs.readFileSync(npmrcPath).toString());
    const registries: string[] = [];

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

export function appendAuthToNpmrc(npmrcPath: string, authEntry: string): void {
    fs.appendFileSync(npmrcPath, os.EOL + authEntry + os.EOL);
    tl.debug(tl.loc('SuccessfulAppend'));
}

export function removeExistingCredentialEntries(
    npmrcPath: string,
    lines: string[],
    registryUrl: URL,
    addedRegistryUrls: URL[]
): string[] {
    let warned = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const referencesHost = line.indexOf(registryUrl.host) !== -1;
        const referencesPath = line.indexOf(registryUrl.pathname) !== -1;
        const isRegistryLine = line.indexOf('registry=') !== -1;
        if (referencesHost && referencesPath && !isRegistryLine) {
            // Suppress the warning if we've already added auth for this exact
            // registry (e.g., same URL appears as both registry= and @scope:registry=).
            const isRegistryAlreadyAdded = addedRegistryUrls.some(
                url => url !== registryUrl && toNerfDart(url.href) === toNerfDart(registryUrl.href)
            );
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

#if WIF
export async function getAzureDevOpsServiceConnectionCredentials(adoServiceConnection: string): Promise<string | undefined> {
    if (!adoServiceConnection) {
        return undefined;
    }
    const federatedAuthToken = await getFederatedWorkloadIdentityCredentials(adoServiceConnection);
    if (!federatedAuthToken) {
        throw new Error(tl.loc('FailedToGetServiceConnectionAuth', adoServiceConnection));
    }
    return federatedAuthToken;
}
#endif
