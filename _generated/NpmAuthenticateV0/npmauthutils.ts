import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as URL from 'url';
import * as fs from 'fs';
import * as os from 'os';
import * as constants from './constants';
import * as ini from 'ini';
import * as pkgLocationUtils from 'azure-pipelines-tasks-packaging-common/locationUtilities';
import { resolveServiceEndpointCredential, NpmrcCredential } from './npmrcCredential';
import { NpmrcBackupManager } from './npmrcBackupManager';

export { NpmrcCredential } from './npmrcCredential';
export { NpmrcBackupManager } from './npmrcBackupManager';

// ─── URL utilities ───────────────────────────────────────────────────────────

/** Ensure a registry URL ends with a trailing slash. */
export function normalizeRegistry(registryUrl: string): string {
    if (registryUrl && !registryUrl.endsWith('/')) {
        registryUrl += '/';
    }
    return registryUrl;
}

/**
 * Convert a registry URL to its nerf-dart form (//host/path/).
 * Used for matching registry entries and formatting .npmrc auth keys.
 */
export function toNerfDart(registryUrl: string): string {
    const parsed = URL.parse(registryUrl);
    const host = (parsed.host || '').toLowerCase();
    let pathname = (parsed.pathname || '/').toLowerCase();
    if (!pathname.endsWith('/')) {
        pathname += '/';
    }
    return `//${host}${pathname}`;
}

// ─── Task setup ──────────────────────────────────────────────────────────────
// Called once at the start of main(): validate inputs, set up temp directories.

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

export function getKnownEndpointsFromVariable(): string[] {
    return tl.getVariable('EXISTING_ENDPOINTS')
        ? tl.getVariable('EXISTING_ENDPOINTS').split(',')
        : [];
}

export function initializeSaveDirectory(): string {
    if (tl.getVariable('SAVE_NPMRC_PATH')) {
        return tl.getVariable('SAVE_NPMRC_PATH');
    }
    let tempPath = tl.getVariable('Agent.BuildDirectory') || tl.getVariable('Agent.TempDirectory');
    tempPath = path.join(tempPath, 'npmAuthenticate');
    tl.mkdirP(tempPath);
    const saveNpmrcPath = fs.mkdtempSync(tempPath + path.sep);
    tl.setVariable('SAVE_NPMRC_PATH', saveNpmrcPath, false);
    tl.setVariable('NPM_AUTHENTICATE_TEMP_DIRECTORY', tempPath, false);
    return saveNpmrcPath;
}

export async function resolvePackagingLocation(): Promise<pkgLocationUtils.PackagingLocation> {
    try {
        return await pkgLocationUtils.getPackagingUris(pkgLocationUtils.ProtocolType.Npm);
    } catch (error) {
        tl.debug('Unable to get packaging URIs');
        logPackagingError(error);
        throw error;
    }
}

// ─── Registry discovery ──────────────────────────────────────────────────────
// Collect credential sources: local project .npmrc feeds + service endpoints.

/**
 * Takes `workingDirectory` (not a file path) because the project .npmrc is always at `{workingDirectory}/.npmrc`.
 * This is NOT the user-specified `workingFile` input that the task modifies.
 */
export function resolveLocalNpmRegistries(
    workingDirectory: string,
    packagingUris: string[]
): NpmrcCredential[] {
    const projectNpmrcPath = path.join(workingDirectory, '.npmrc');

    if (!fs.existsSync(projectNpmrcPath)) {
        return [];
    }

    // Extract host names from the org's packaging URIs for comparison.
    const packagingHosts = packagingUris
        .map(uri => { try { return new URL.URL(uri).host.toLowerCase(); } catch { return undefined; } })
        .filter((host): host is string => host !== undefined);

    // Parse the project .npmrc and keep only registries whose host matches
    // one of the org's packaging hosts — these are internal feeds.
    const allRegistries = getRegistriesFromNpmrc(projectNpmrcPath);
    const localRegistries = allRegistries.filter(registryUrl => {
        try {
            const host = new URL.URL(registryUrl).host.toLowerCase();
            return packagingHosts.includes(host);
        } catch {
            return false;
        }
    });

    tl.debug(tl.loc('FoundLocalRegistries', localRegistries.length));

    // Authenticate each local registry with the pipeline's System.AccessToken.
    return localRegistries.map(registryUrl => {
        const nerfed = toNerfDart(registryUrl);
        // SYSTEMVSSCONNECTION is always OAuth — getEndpointAuthorizationParameter throws if missing.
        const accessToken = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'AccessToken', false);
        tl.setSecret(accessToken);
        return {
            url: registryUrl,
            auth: `${nerfed}:_authToken=${accessToken}`,
            authOnly: true
        };
    });
}

/**
 * Resolve credentials for each service endpoint listed in the `customEndpoint`
 * task input.  Each endpoint is read from the task lib, its auth scheme is
 * mapped to .npmrc credential lines, and secrets are masked.
 */
export async function resolveEndpointRegistries(knownEndpoints: string[]): Promise<NpmrcCredential[]> {
    const endpointIds = tl.getDelimitedInput(constants.NpmAuthenticateTaskInput.CustomEndpoint, ',');
    if (!endpointIds || endpointIds.length === 0) {
        return [];
    }

    const registries: NpmrcCredential[] = [];
    await Promise.all(endpointIds.map(async (endpointId) => {
        const credential = await resolveServiceEndpointCredential(endpointId, normalizeRegistry, toNerfDart);
        if (knownEndpoints.indexOf(credential.url) !== -1) {
            tl.warning(tl.loc('DuplicateCredentials', credential.url));
        } else {
            knownEndpoints.push(credential.url);
            tl.setVariable('EXISTING_ENDPOINTS', knownEndpoints.join(','), false);
        }
        registries.push(credential);
    }));
    return registries;
}

// ─── Per-registry credential matching ────────────────────────────────────────
// Called inside the auth loop to find which credential source matches a registry URL.

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
    knownEndpoints: string[],
    registryHost: string
): NpmrcCredential | null {
    for (const localRegistry of localRegistries) {
        if (toNerfDart(localRegistry.url) === toNerfDart(registryUrlString)) {
            if (knownEndpoints.indexOf(localRegistry.url) !== -1) {
                // Warn when a local registry was already configured via a service endpoint.
                tl.warning(tl.loc('DuplicateCredentials', localRegistry.url));
                tl.warning(tl.loc('FoundEndpointCredentials', registryHost));
            }
            return localRegistry;
        }
    }
    return null;
}

// ─── .npmrc reading and writing ──────────────────────────────────────────────
// Parse registries from .npmrc, append auth entries, strip stale credentials.

/** Parse all registry URLs from an .npmrc file, normalizing and saving them back. */
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

    // Write normalized registry URLs back to disk so downstream npm/yarn
    // sees consistent trailing-slash URLs.
    tl.writeFile(npmrcPath, ini.stringify(config));

    return registries;
}

/** Append auth lines to the end of an .npmrc file. */
export function appendAuthToNpmrc(npmrcPath: string, authEntry: string): void {
    fs.appendFileSync(npmrcPath, os.EOL + authEntry + os.EOL);
}

/**
 * Removes any credential lines that reference `registryUrl` from `lines` and
 * writes the updated content back to disk.  Warns once if checked-in
 * credentials are being overridden (suppressed when the same URL appears
 * multiple times in the file, e.g. both `registry=` and `@scope:registry=`).
 */
export function removeExistingCredentialEntries(
    npmrcPath: string,
    lines: string[],
    registryUrl: URL.Url,
    addedRegistryUrls: URL.Url[]
): string[] {
    let warned = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const referencesHost = line.indexOf(registryUrl.host) !== -1;
        const referencesPath = line.indexOf(registryUrl.path) !== -1;
        const isRegistryLine = line.indexOf('registry=') !== -1;
        if (referencesHost && referencesPath && !isRegistryLine) {
            if (!warned && addedRegistryUrls.indexOf(registryUrl) === -1) {
                tl.warning(tl.loc('CheckedInCredentialsOverriden', registryUrl.host));
            }
            warned = true;
            lines[i] = '';
        }
    }
    fs.writeFileSync(npmrcPath, lines.join(os.EOL));
    return lines;
}

// ─── WIF helpers ─────────────────────────────────────────────────────────────


// ─── Error logging ───────────────────────────────────────────────────────────

export function logPackagingError(error: Error): void {
    if (error && (error as any).stack) {
        tl.debug((error as any).stack);
    }
    tl.error(error && (error as any).message ? (error as any).message : String(error));
}
