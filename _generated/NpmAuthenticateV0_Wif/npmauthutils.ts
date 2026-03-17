import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as os from 'os';
import * as constants from './constants';
import * as ini from 'ini';
import * as pkgLocationUtils from 'azure-pipelines-tasks-packaging-common/locationUtilities';
import { resolveServiceEndpointCredential, NpmrcCredential } from './npmrcCredential';
import { NpmrcBackupManager } from './npmrcBackupManager';
import { getFederatedWorkloadIdentityCredentials } from 'azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils';

export { NpmrcCredential } from './npmrcCredential';
export { NpmrcBackupManager } from './npmrcBackupManager';

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

// Discovers registries from the project-scoped .npmrc (workingDirectory/.npmrc)
// that match packaging service hosts, and authenticates them with System.AccessToken.
// Takes workingDirectory (not a file path) because this reads the project .npmrc
// alongside package.json, NOT the user-specified workingFile input.
export function resolveInternalFeedCredentials(
    workingDirectory: string,
    packagingUris: string[]
): NpmrcCredential[] {
    const projectNpmrcPath = path.join(workingDirectory, '.npmrc');

    if (!fs.existsSync(projectNpmrcPath)) {
        return [];
    }

    const packagingHosts = packagingUris
        .map(uri => { try { return new URL(uri).host.toLowerCase(); } catch { return undefined; } })
        .filter((host): host is string => host !== undefined);

    const allRegistries = getRegistriesFromNpmrc(projectNpmrcPath);
    const localRegistries = allRegistries.filter(registryUrl => {
        try {
            const host = new URL(registryUrl).host.toLowerCase();
            return packagingHosts.includes(host);
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
        return {
            url: registryUrl,
            auth: `${nerfed}:_authToken=${accessToken}`,
            authOnly: true
        };
    });
}

export async function resolveEndpointRegistries(previouslyAuthenticatedUrls: string[]): Promise<NpmrcCredential[]> {
    const endpointIds = tl.getDelimitedInput(constants.NpmAuthenticateTaskInput.CustomEndpoint, ',');
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
        if (toNerfDart(endpoint.url) === toNerfDart(registryUrlString)) {
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
        if (toNerfDart(localRegistry.url) === toNerfDart(registryUrlString)) {
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
        tl.warning(`npmrc file not found: ${npmrcPath}`);
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

export function logPackagingError(error: Error): void {
    if (error && (error as any).stack) {
        tl.debug((error as any).stack);
    }
    tl.error(error && (error as any).message ? (error as any).message : String(error));
}
