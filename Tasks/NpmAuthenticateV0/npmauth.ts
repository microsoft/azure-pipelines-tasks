import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as os from 'os';
import { emitTelemetry } from "azure-pipelines-tasks-artifacts-common/telemetry";
import * as npmauthutils from './npmauthutils';

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
    const backupManager = new npmauthutils.NpmrcBackupManager(backupDirectory);
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

#if WIF
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
#endif

    for (let RegistryURLString of npmrcRegistries) {
        let registryURL: URL;
        try {
            registryURL = new URL(RegistryURLString);
        } catch {
            tl.warning(tl.loc('InvalidRegistryUrl', RegistryURLString));
            continue;
        }
        let npmrcEntry: npmauthutils.NpmrcCredential;

        // Auth resolution priority: WIF > external service connection > internal feed.
        // The first match wins; subsequent sources are skipped for this registry.

#if WIF
        if (entraWifServiceConnectionName) {
            console.log(tl.loc("AddingEndpointCredentials", entraWifServiceConnectionName));
            npmrcEntry = { url: RegistryURLString, auth: `${npmauthutils.toNerfDart(RegistryURLString)}:_authToken=${federatedAuthToken}` };
            addedRegistries.push(registryURL);
            npmrcFile = npmauthutils.removeExistingCredentialEntries(npmrc, npmrcFile, registryURL, addedRegistries);
            federatedFeedAuthSuccessCount++;
            console.log(tl.loc("Info_SuccessAddingFederatedFeedAuth", RegistryURLString));
        }
#endif

        if (!npmrcEntry && endpointRegistries.length > 0) {
            npmrcEntry = npmauthutils.tryResolveFromEndpoints(RegistryURLString, endpointRegistries);
            if (npmrcEntry) {
                let serviceURL = new URL(npmrcEntry.url);
                console.log(tl.loc("AddingEndpointCredentials", registryURL.host));
                addedRegistries.push(serviceURL);
                npmrcFile = npmauthutils.removeExistingCredentialEntries(npmrc, npmrcFile, serviceURL, addedRegistries);
                externalFeedSuccessCount++;
            }
        }

        if (!npmrcEntry) {
            npmrcEntry = npmauthutils.tryResolveFromLocalRegistries(
                RegistryURLString,
                internalFeedCredentials,
                previouslyAuthenticatedUrls,
                registryURL.host
            );
            if (npmrcEntry) {
                let localURL = new URL(npmrcEntry.url);
                console.log(tl.loc("AddingLocalCredentials"));
                addedRegistries.push(localURL);
                npmrcFile = npmauthutils.removeExistingCredentialEntries(npmrc, npmrcFile, localURL, addedRegistries);
                internalFeedSuccessCount++;
            }
        }

        if (npmrcEntry) {
            tl.debug(tl.loc('AddingAuthRegistry', npmrcEntry.url));
            npmauthutils.appendAuthToNpmrc(npmrc, npmrcEntry.auth);
            tl.debug(tl.loc('SuccessfulAppend'));
            npmrcFile.push(os.EOL + npmrcEntry.auth + os.EOL);
            tl.debug(tl.loc('SuccessfulPush'));
        }
        else {
            console.log(tl.loc("IgnoringRegistry", registryURL.host));
        }
    }
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
