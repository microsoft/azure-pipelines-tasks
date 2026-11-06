import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as os from 'os';
import { emitTelemetry } from "azure-pipelines-tasks-artifacts-common/telemetry";
import * as npmauthutils from './npmauthutils';
import { NpmrcCredential } from './npmrcCredential';
import { NpmrcBackupManager, NpmrcFileIdentityTaskVariable } from './npmrcBackupManager';
import { NpmConfigTelemetryPhase } from './constants';
import { cleanupGlobalConfig, saveAndActivateGlobalConfig } from './npmGlobalConfig';

let internalFeedSuccessCount: number = 0;
let externalFeedSuccessCount: number = 0;
let federatedFeedAuthSuccessCount: number = 0;

async function main(): Promise<void> {
    npmauthutils.emitNpmConfigTelemetry(NpmConfigTelemetryPhase.Main);
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    // Path to user provided npmrc
    const npmrc = npmauthutils.validateNpmrcPath();
    const useGlobalConfig = tl.getBoolInput('useGlobalConfig');
    const globalCredentials: NpmrcCredential[] = useGlobalConfig ? [] : undefined;
    const previouslyAuthenticatedUrls = npmauthutils.getPreviouslyAuthenticatedUrls();

    // Preserve the original user provided .npmrc on first task execution, so the post-job cleanup can restore it. 
    if (!useGlobalConfig) {
        const backupDirectory = npmauthutils.initializeBackupDirectory();
        const backupManager = new NpmrcBackupManager(backupDirectory);
        const fileIdentity = backupManager.ensureBackedUp(npmrc);
        tl.setTaskVariable(NpmrcFileIdentityTaskVariable, JSON.stringify(fileIdentity));
    }
    let npmrcRegistries = npmauthutils.getRegistriesFromNpmrc(npmrc, useGlobalConfig);
    
    let packagingLocation;
    try {
        packagingLocation = await npmauthutils.resolvePackagingLocation();
    } catch (error) {
        tl.error(tl.loc('Error_UnableToGetPackagingUris'));
        throw error;   
    }

    // Collect internal feeds (from .npmrc) and external registries (from service connections)
    const internalFeedCredentials = npmauthutils.resolveInternalFeedCredentials(npmrc, packagingLocation.PackagingUris, useGlobalConfig);
    const endpointRegistries = await npmauthutils.resolveEndpointRegistries(previouslyAuthenticatedUrls);

    // Read the target .npmrc into memory for credential line replacement
    const npmrcFile = fs.readFileSync(npmrc, 'utf8').split(os.EOL);

    const addedRegistries: URL[] = [];

#if WIF
    const entraWifServiceConnectionName = tl.getInput("workloadIdentityServiceConnection");
    const feedUrl = tl.getInput("feedUrl");
    let federatedAuthToken: string | undefined;

    if (entraWifServiceConnectionName) {
        npmrcRegistries = npmauthutils.validateAndFilterRegistryUrls(npmrcRegistries);
        federatedAuthToken = await npmauthutils.getAzureDevOpsServiceConnectionCredentials(entraWifServiceConnectionName);

        // When feedUrl is provided, only add WIF credentials for matching registries in the npmrc.
        // Otherwise, apply WIF credentials to all registries (pre-feedUrl input behavior).
        if (feedUrl) {
            npmrcRegistries = npmrcRegistries.filter(x => npmauthutils.toNerfDart(x) === npmauthutils.toNerfDart(feedUrl));
            if (npmrcRegistries.length === 0) {
                throw new Error(tl.loc("IgnoringRegistry", feedUrl));
            }
        } else {
            tl.debug(tl.loc('Info_ApplyingWifToAllRegistries', npmrcRegistries.length));
        }
    } else if (feedUrl) {
        throw new Error(tl.loc("MissingFeedUrlOrServiceConnection"));
    }
#endif

    for (const registryUrlString of npmrcRegistries) {
        let registryURL: URL;
        try {
            registryURL = new URL(registryUrlString);
        } catch {
            tl.warning(tl.loc('InvalidRegistryUrl', registryUrlString));
            continue;
        }

        // Auth resolution priority: WIF > external service connection > internal feed.
        // First match wins; subsequent sources are skipped for this registry.
#if WIF
        if (entraWifServiceConnectionName) {
            if (registryURL.protocol !== 'https:') {
                npmauthutils.writeRepositoryOutput(tl.loc('Info_SkippingNonHttpsWifRegistry', registryUrlString));
                continue;
            }

            npmauthutils.writeRepositoryOutput(tl.loc("Info_AddingFederatedFeedAuth", entraWifServiceConnectionName, registryUrlString));
            npmauthutils.writeRepositoryOutput(tl.loc("AddingEndpointCredentials", entraWifServiceConnectionName));
            const npmrcEntry: NpmrcCredential = { url: registryUrlString, auth: `${npmauthutils.toNerfDart(registryUrlString)}:_authToken=${federatedAuthToken}` };
            writeCredentialEntry(npmrc, npmrcFile, npmrcEntry, registryURL, addedRegistries, globalCredentials);
            federatedFeedAuthSuccessCount++;
            npmauthutils.writeRepositoryOutput(tl.loc("Info_SuccessAddingFederatedFeedAuth", registryUrlString));
            continue;
        }
#endif

        if (endpointRegistries.length > 0) {
            const npmrcEntry = npmauthutils.tryResolveFromEndpoints(registryUrlString, endpointRegistries);
            if (npmrcEntry) {
                npmauthutils.writeRepositoryOutput(tl.loc("AddingEndpointCredentials", registryURL.host));
                writeCredentialEntry(npmrc, npmrcFile, npmrcEntry, new URL(npmrcEntry.url), addedRegistries, globalCredentials);
                externalFeedSuccessCount++;
                continue;
            }
        }

        const npmrcEntry = npmauthutils.tryResolveFromLocalRegistries(
            registryUrlString,
            internalFeedCredentials,
            previouslyAuthenticatedUrls,
            registryURL.host
        );
        if (npmrcEntry) {
            npmauthutils.writeRepositoryOutput(tl.loc("AddingLocalCredentials"));
            writeCredentialEntry(npmrc, npmrcFile, npmrcEntry, new URL(npmrcEntry.url), addedRegistries, globalCredentials);
            internalFeedSuccessCount++;
            continue;
        }

        npmauthutils.writeRepositoryOutput(tl.loc("IgnoringRegistry", registryURL.host));
    }
    if (useGlobalConfig) {
        saveAndActivateGlobalConfig(globalCredentials);
    }
}

/** Removes any pre-existing credential lines for the registry, then appends fresh auth. */
function writeCredentialEntry(
    npmrcPath: string,
    npmrcFile: string[],
    entry: NpmrcCredential,
    registryURL: URL,
    addedRegistries: URL[],
    globalCredentials?: NpmrcCredential[]
): void {
    if (globalCredentials) {
        globalCredentials.push(entry);
        return;
    }
    addedRegistries.push(registryURL);
    npmauthutils.replaceAuthInNpmrc(npmrcPath, npmrcFile, entry, registryURL, addedRegistries);
}


main().catch(error => {
    if (tl.getBoolInput('useGlobalConfig')) {
        try {
            cleanupGlobalConfig({ onlyUnactivated: true });
        } catch (cleanupError) {
            tl.error(tl.loc('Error_GlobalConfigCleanup'));
        }
    } else if (tl.getVariable("NPM_AUTHENTICATE_TEMP_DIRECTORY")) {
        tl.rmRF(tl.getVariable("NPM_AUTHENTICATE_TEMP_DIRECTORY"));
        // Clear the variables after we rm-rf the main root directory
        tl.setVariable("SAVE_NPMRC_PATH", "", false);
        tl.setVariable("NPM_AUTHENTICATE_TEMP_DIRECTORY", "", false);
    } 
    tl.setResult(tl.TaskResult.Failed, error);
}).finally(() => {
    emitTelemetry("Packaging", "NpmAuthenticateV0", {
        "InternalFeedAuthCount": internalFeedSuccessCount,
        "ExternalFeedAuthCount": externalFeedSuccessCount,
        "FederatedFeedAuthCount": federatedFeedAuthSuccessCount
    });
});
