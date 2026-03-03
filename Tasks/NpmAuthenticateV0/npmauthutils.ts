import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as URL from 'url';
import * as fs from 'fs';
import * as os from 'os';
import * as constants from './constants';
import * as npmregistry from 'azure-pipelines-tasks-packaging-common/npm/npmregistry';
import * as npmutil from 'azure-pipelines-tasks-packaging-common/npm/npmutil';
import * as npmrcparser from 'azure-pipelines-tasks-packaging-common/npm/npmrcparser';
import * as pkgLocationUtils from 'azure-pipelines-tasks-packaging-common/locationUtilities';
#if WIF
import { getFederatedWorkloadIdentityCredentials } from 'azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils';
#endif

// ─── NpmrcBackupManager ──────────────────────────────────────────────────────
//
// Tracks which .npmrc files have been backed up during this pipeline run so
// that npmauthcleanup can restore them to their original state.  State is
// persisted to an index.json file inside the agent temp directory so that
// multiple consecutive calls to NpmAuthenticate on the same .npmrc are
// idempotent (the very first snapshot is kept and used for the final restore).

export class NpmrcBackupManager {
    private readonly indexFilePath: string;
    private index: { [key: string]: number };

    constructor(private readonly saveNpmrcPath: string) {
        this.indexFilePath = path.join(saveNpmrcPath, 'index.json');
        this.index = this.loadOrCreateIndex();
    }

    /** Backs up `npmrcPath` if it has not already been backed up this run. */
    ensureBackedUp(npmrcPath: string): void {
        if (this.index[npmrcPath] !== undefined) {
            return;
        }
        const entryId = this.index['index']++;
        this.index[npmrcPath] = entryId;
        this.saveIndex();
        this.saveFileWithName(npmrcPath, entryId);
    }

    restoreBackedUpFile(npmrcPath: string): boolean {
        const entryId = this.index[npmrcPath];
        if (entryId === undefined) {
            return false;
        }

        const backupPath = this.getBackupFilePath(entryId);
        if (!tl.exist(backupPath)) {
            return false;
        }

        fs.copyFileSync(backupPath, npmrcPath);
        fs.unlinkSync(backupPath);
        return true;
    }

    isOnlyIndexFileRemaining(): boolean {
        return fs.readdirSync(this.saveNpmrcPath).length === 1;
    }

    private loadOrCreateIndex(): { [key: string]: number } {
        if (fs.existsSync(this.indexFilePath)) {
            return JSON.parse(fs.readFileSync(this.indexFilePath, 'utf8'));
        }
        return { index: 0 };
    }

    private saveIndex(): void {
        fs.writeFileSync(this.indexFilePath, JSON.stringify(this.index));
    }

    private getBackupFilePath(entryId: number | string): string {
        return path.join(this.saveNpmrcPath, String(entryId));
    }

    private saveFileWithName(sourcePath: string, entryId: number | string): void {
        const backupPath = this.getBackupFilePath(entryId);
        tl.debug(tl.loc('SavingFile', sourcePath));
        fs.copyFileSync(sourcePath, backupPath);
    }

    static fromSaveDirectory(saveNpmrcPath: string): NpmrcBackupManager {
        return new NpmrcBackupManager(saveNpmrcPath);
    }
}

// ─── Input validation ────────────────────────────────────────────────────────

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

// ─── Agent temp-directory setup ──────────────────────────────────────────────

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

// ─── Packaging location ──────────────────────────────────────────────────────

export async function resolvePackagingLocation(): Promise<pkgLocationUtils.PackagingLocation> {
    try {
        return await pkgLocationUtils.getPackagingUris(pkgLocationUtils.ProtocolType.Npm);
    } catch (error) {
        tl.debug('Unable to get packaging URIs');
        logPackagingError(error);
        throw error;
    }
}

export async function resolveLocalNpmRegistries(
    workingDirectory: string,
    packagingUris: string[]
): Promise<npmregistry.INpmRegistry[]> {
    return npmutil.getLocalNpmRegistries(workingDirectory, packagingUris);
}

// ─── Service-endpoint registries ─────────────────────────────────────────────

export async function resolveEndpointRegistries(knownEndpoints: string[]): Promise<npmregistry.INpmRegistry[]> {
    const endpointIds = tl.getDelimitedInput(constants.NpmAuthenticateTaskInput.CustomEndpoint, ',');
    if (!endpointIds || endpointIds.length === 0) {
        return [];
    }

    const registries: npmregistry.INpmRegistry[] = [];
    await Promise.all(endpointIds.map(async (endpointId) => {
        const registry = await npmregistry.NpmRegistry.FromServiceEndpoint(endpointId, true);
        if (knownEndpoints.indexOf(registry.url) !== -1) {
            tl.warning(tl.loc('DuplicateCredentials', registry.url));
        } else {
            knownEndpoints.push(registry.url);
            tl.setVariable('EXISTING_ENDPOINTS', knownEndpoints.join(','), false);
        }
        registries.push(registry);
    }));
    return registries;
}

export function getRegistriesFromNpmrc(npmrcPath: string): string[] {
    return npmrcparser.GetRegistries(npmrcPath, /* saveNormalizedRegistries */ true);
}

export function normalizeRegistry(registryUrl: string): string {
    return npmrcparser.NormalizeRegistry(registryUrl);
}

export function toNerfDart(registryUrl: string): string {
    const parsed = URL.parse(registryUrl);
    const host = (parsed.host || '').toLowerCase();
    let pathname = (parsed.pathname || '/').toLowerCase();
    if (!pathname.endsWith('/')) {
        pathname += '/';
    }
    return `//${host}${pathname}`;
}

export function appendAuthToNpmrc(npmrcPath: string, authLine: string): void {
    npmutil.appendToNpmrc(npmrcPath, os.EOL + authLine + os.EOL);
}

export function logPackagingError(error: Error): void {
    if (error && (error as any).stack) {
        tl.debug((error as any).stack);
    }
    tl.error(error && (error as any).message ? (error as any).message : String(error));
}

// ─── Per-registry credential resolution ─────────────────────────────────────

export function tryResolveFromEndpoints(
    registryUrlString: string,
    endpointRegistries: npmregistry.INpmRegistry[]
): npmregistry.INpmRegistry | null {
    for (const endpoint of endpointRegistries) {
        if (toNerfDart(endpoint.url) === toNerfDart(registryUrlString)) {
            return endpoint;
        }
    }
    return null;
}

export function tryResolveFromLocalRegistries(
    registryUrlString: string,
    localRegistries: npmregistry.INpmRegistry[],
    knownEndpoints: string[],
    registryHost: string
): npmregistry.INpmRegistry | null {
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

// ─── npmrc line editing ──────────────────────────────────────────────────────

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
            // Suppress the warning if we already handled this registry URL
            // (e.g. registry={url} and @scope:registry={url} in .npmrc).
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
