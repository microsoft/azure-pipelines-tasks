import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as URL from 'url';
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
    let workingDirectory = path.dirname(npmrc);
    let endpointsArray = npmauthutils.getKnownEndpointsFromVariable();

    const saveNpmrcPath = npmauthutils.initializeSaveDirectory();
    const backupManager = new npmauthutils.NpmrcBackupManager(saveNpmrcPath);
    backupManager.ensureBackedUp(npmrc);
    
    let packagingLocation;
    try {
        packagingLocation = await npmauthutils.resolvePackagingLocation();
    } catch (error) {
        tl.debug('Unable to get packaging URIs');
        npmauthutils.logPackagingError(error);
        throw error;
    }
    // Source set A: discover candidate credentials from project context.
    // Discover registries from the project-scoped .npmrc (working directory) that match packaging service hosts.
    let localProjectNpmRegistries = await npmauthutils.resolveLocalNpmRegistries(workingDirectory, packagingLocation.PackagingUris);
    // Resolve registries from configured service endpoints (higher-priority auth sources).
    let endpointRegistries = await npmauthutils.resolveEndpointRegistries(endpointsArray);

    // Source set B: parse and rewrite the user-provided npmrc input file.
    // Load the user-provided npmrc input file into memory so credential lines can be inspected and rewritten.
    let npmrcFile = fs.readFileSync(npmrc, 'utf8').split(os.EOL);

    // Track registries already processed to prevent duplicate override warnings.
    let addedRegistry = [];
    // Parse registry entries declared in the target .npmrc; this drives the auth loop below.
    let npmrcRegistries = npmauthutils.getRegistriesFromNpmrc(npmrc);

#if WIF
    const entraWifServiceConnectionName = tl.getInput("workloadIdentityServiceConnection");
    const federatedAuthToken = await npmauthutils.getAzureDevOpsServiceConnectionCredentials(entraWifServiceConnectionName)

    const feedUrl = tl.getInput("feedUrl");
    if (feedUrl && !entraWifServiceConnectionName) {
        throw new Error(tl.loc("MissingFeedUrlOrServiceConnection"));
    }

    if(feedUrl){
        npmrcRegistries = npmrcRegistries.filter(x=> npmauthutils.toNerfDart(x) == npmauthutils.toNerfDart(npmauthutils.normalizeRegistry(feedUrl)));
        if(npmrcRegistries.length == 0){
            throw new Error(tl.loc("IgnoringRegistry", feedUrl));
        }
    }
#endif

    for (let RegistryURLString of npmrcRegistries) {
        let registryURL = URL.parse(RegistryURLString);
        let registry: npmauthutils.NpmrcCredential;

#if WIF
        if (feedUrl && entraWifServiceConnectionName){
            if (npmauthutils.toNerfDart(npmauthutils.normalizeRegistry(feedUrl)) == npmauthutils.toNerfDart(RegistryURLString)) {
                console.log(tl.loc("AddingEndpointCredentials", entraWifServiceConnectionName));
                registry =  { url: RegistryURLString, auth: `${npmauthutils.toNerfDart(RegistryURLString)}:_authToken=${federatedAuthToken}`, authOnly: true };
                let url = URL.parse(RegistryURLString);
                addedRegistry.push(url);
                npmrcFile = npmauthutils.removeExistingCredentialEntries(npmrc, npmrcFile, url, addedRegistry);
                federatedFeedAuthSuccessCount++;
                console.log(tl.loc("Info_SuccessAddingFederatedFeedAuth", RegistryURLString));
            }
        } else if (!feedUrl && entraWifServiceConnectionName){
            console.log(tl.loc("AddingEndpointCredentials", entraWifServiceConnectionName));
            registry = { url: RegistryURLString, auth: `${npmauthutils.toNerfDart(RegistryURLString)}:_authToken=${federatedAuthToken}`, authOnly: true }
            let url = URL.parse(RegistryURLString);
            addedRegistry.push(url);
            npmrcFile = npmauthutils.removeExistingCredentialEntries(npmrc, npmrcFile, url, addedRegistry);
            federatedFeedAuthSuccessCount++;
            console.log(tl.loc("Info_SuccessAddingFederatedFeedAuth", RegistryURLString));
        }
#endif

        if (!registry && endpointRegistries && endpointRegistries.length > 0) {
            registry = npmauthutils.tryResolveFromEndpoints(RegistryURLString, endpointRegistries) as npmauthutils.NpmrcCredential;
            if (registry) {
                let serviceURL = URL.parse(registry.url);
                console.log(tl.loc("AddingEndpointCredentials", registryURL.host));
                addedRegistry.push(serviceURL);
                npmrcFile = npmauthutils.removeExistingCredentialEntries(npmrc, npmrcFile, serviceURL, addedRegistry);
                externalFeedSuccessCount++;
            }
        }

        if (!registry) {
            registry = npmauthutils.tryResolveFromLocalRegistries(
                RegistryURLString,
                localProjectNpmRegistries,
                endpointsArray,
                registryURL.host
            ) as npmauthutils.NpmrcCredential;
            if (registry) {
                let localURL = URL.parse(registry.url);
                console.log(tl.loc("AddingLocalCredentials"));
                addedRegistry.push(localURL);
                npmrcFile = npmauthutils.removeExistingCredentialEntries(npmrc, npmrcFile, localURL, addedRegistry);
            }
        }

        if (registry) {
            tl.debug(tl.loc('AddingAuthRegistry', registry.url));
            npmauthutils.appendAuthToNpmrc(npmrc, registry.auth);
            tl.debug(tl.loc('SuccessfulAppend'));
            npmrcFile.push(os.EOL + registry.auth + os.EOL);
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
