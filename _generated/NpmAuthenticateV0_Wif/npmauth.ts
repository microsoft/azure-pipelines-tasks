import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as os from 'os';
import { emitTelemetry } from "azure-pipelines-tasks-artifacts-common/telemetry";
import * as npmauthutils from './npmauthutils';
import { NpmrcCredential } from './npmrcCredential';
import { NpmrcBackupManager } from './npmrcBackupManager';

let internalFeedSuccessCount: number = 0;
let externalFeedSuccessCount: number = 0;
let federatedFeedAuthSuccessCount: number = 0;

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    const npmrc = npmauthutils.validateNpmrcPath();
    const workingDirectory = path.dirname(npmrc);
    const previouslyAuthenticatedUrls = npmauthutils.getPreviouslyAuthenticatedUrls();

    // Preserve the original .npmrc on first task execution, so the post-job cleanup can restore it. 
    const backupDirectory = npmauthutils.initializeBackupDirectory();
    const backupManager = new NpmrcBackupManager(backupDirectory);
    backupManager.ensureBackedUp(npmrc);
    
    let packagingLocation;
    try {
        packagingLocation = await npmauthutils.resolvePackagingLocation();
    } catch (error) {
        tl.error(tl.loc('Error_UnableToGetPackagingUris'));
        throw error;
    }

    // Collect auth sources: internal feeds (from project .npmrc) and external registries (from service connections)
    const internalFeedCredentials = npmauthutils.resolveInternalFeedCredentials(workingDirectory, packagingLocation.PackagingUris);
    const endpointRegistries = await npmauthutils.resolveEndpointRegistries(previouslyAuthenticatedUrls);

    // Read the target .npmrc into memory for credential line replacement
    let npmrcFile = fs.readFileSync(npmrc, 'utf8').split(os.EOL);

    let addedRegistries: URL[] = [];
    let npmrcRegistries = npmauthutils.getRegistriesFromNpmrc(npmrc);

    const entraWifServiceConnectionName = tl.getInput("workloadIdentityServiceConnection");
    const feedUrl = tl.getInput("feedUrl");
    let federatedAuthToken: string | undefined;

    if (entraWifServiceConnectionName) {
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

    for (const RegistryURLString of npmrcRegistries) {
        let registryURL: URL;
        try {
            registryURL = new URL(RegistryURLString);
        } catch {
            tl.warning(tl.loc('InvalidRegistryUrl', RegistryURLString));
            continue;
        }

        // Auth resolution priority: WIF > external service connection > internal feed.
        // First match wins; subsequent sources are skipped for this registry.
        if (entraWifServiceConnectionName) {
            console.log(tl.loc("AddingEndpointCredentials", entraWifServiceConnectionName));
            const npmrcEntry: NpmrcCredential = { url: RegistryURLString, auth: `${npmauthutils.toNerfDart(RegistryURLString)}:_authToken=${federatedAuthToken}` };
            writeCredentialEntry(npmrc, npmrcFile, npmrcEntry, registryURL, addedRegistries);
            federatedFeedAuthSuccessCount++;
            console.log(tl.loc("Info_SuccessAddingFederatedFeedAuth", RegistryURLString));
            continue;
        }

        if (endpointRegistries.length > 0) {
            const npmrcEntry = npmauthutils.tryResolveFromEndpoints(RegistryURLString, endpointRegistries);
            if (npmrcEntry) {
                console.log(tl.loc("AddingEndpointCredentials", registryURL.host));
                writeCredentialEntry(npmrc, npmrcFile, npmrcEntry, new URL(npmrcEntry.url), addedRegistries);
                externalFeedSuccessCount++;
                continue;
            }
        }

        const npmrcEntry = npmauthutils.tryResolveFromLocalRegistries(
            RegistryURLString,
            internalFeedCredentials,
            previouslyAuthenticatedUrls,
            registryURL.host
        );
        if (npmrcEntry) {
            console.log(tl.loc("AddingLocalCredentials"));
            writeCredentialEntry(npmrc, npmrcFile, npmrcEntry, new URL(npmrcEntry.url), addedRegistries);
            internalFeedSuccessCount++;
            continue;
        }

        console.log(tl.loc("IgnoringRegistry", registryURL.host));
    }
}

/** Removes any pre-existing credential lines for the registry, then appends fresh auth. */
function writeCredentialEntry(
    npmrcPath: string,
    npmrcFile: string[],
    entry: NpmrcCredential,
    registryURL: URL,
    addedRegistries: URL[]
): void {
    addedRegistries.push(registryURL);
    npmauthutils.removeExistingCredentialEntries(npmrcPath, npmrcFile, registryURL, addedRegistries);
    tl.debug(tl.loc('AddingAuthRegistry', entry.url));
    npmauthutils.appendAuthToNpmrc(npmrcPath, entry.auth);
    npmrcFile.push(os.EOL + entry.auth + os.EOL);
}


main().catch(error => {
    if (tl.getVariable("NPM_AUTHENTICATE_TEMP_DIRECTORY")) {
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
