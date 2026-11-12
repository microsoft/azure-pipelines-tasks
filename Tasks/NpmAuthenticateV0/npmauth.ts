import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as os from 'os';
import { emitTelemetry } from "azure-pipelines-tasks-artifacts-common/telemetry";
#if WIF
import { requireHttpsUrl } from "azure-pipelines-tasks-artifacts-common/webapi";
import { verifyAzureArtifactsFeedUrl } from "azure-pipelines-tasks-artifacts-common/feedUrlUtils";
import { getFederatedWorkloadIdentityCredentialsForFeed } from "azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils";
import { ProtocolType } from "azure-pipelines-tasks-artifacts-common/protocols";
#endif
import * as npmauthutils from './npmauthutils';
import { NpmrcCredential } from './npmrcCredential';
import { NpmrcBackupManager, NpmrcFileIdentityTaskVariable } from './npmrcBackupManager';
import { NpmConfigTelemetryPhase } from './constants';

let internalFeedSuccessCount: number = 0;
let externalFeedSuccessCount: number = 0;
let federatedFeedAuthSuccessCount: number = 0;

async function main(): Promise<void> {
    npmauthutils.emitNpmConfigTelemetry(NpmConfigTelemetryPhase.Main);
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    // Path to user provided npmrc
    const npmrc = npmauthutils.validateNpmrcPath();
    const previouslyAuthenticatedUrls = npmauthutils.getPreviouslyAuthenticatedUrls();

    // Preserve the original user provided .npmrc on first task execution, so the post-job cleanup can restore it. 
    const backupDirectory = npmauthutils.initializeBackupDirectory();
    const backupManager = new NpmrcBackupManager(backupDirectory);
    const fileIdentity = backupManager.ensureBackedUp(npmrc);
    tl.setTaskVariable(NpmrcFileIdentityTaskVariable, JSON.stringify(fileIdentity));
    let npmrcRegistries = npmauthutils.getRegistriesFromNpmrc(npmrc);
    
    let packagingLocation;
    try {
        packagingLocation = await npmauthutils.resolvePackagingLocation();
    } catch (error) {
        tl.error(tl.loc('Error_UnableToGetPackagingUris'));
        throw error;   
    }

    // Collect internal feeds (from .npmrc) and external registries (from service connections)
    const internalFeedCredentials = npmauthutils.resolveInternalFeedCredentials(npmrc, packagingLocation.PackagingUris);
    const endpointRegistries = await npmauthutils.resolveEndpointRegistries(previouslyAuthenticatedUrls);

    // Read the target .npmrc into memory for credential line replacement
    const npmrcFile = fs.readFileSync(npmrc, 'utf8').split(os.EOL);

    const addedRegistries: URL[] = [];

#if WIF
    const entraWifServiceConnectionName = tl.getInput("workloadIdentityServiceConnection");
    const feedUrlInput = tl.getInput("feedUrl");
    let federatedAccessTokens = new Map<string, string>();

    if (entraWifServiceConnectionName) {
        npmrcRegistries = npmauthutils.validateAndFilterRegistryUrls(npmrcRegistries);

        // When feedUrl is provided, only add WIF credentials for matching registries in the npmrc.
        // Otherwise, apply WIF credentials to all Azure Artifacts registries (pre-feedUrl input behavior).
        if (feedUrlInput) {
            const feedUrl = requireHttpsUrl(feedUrlInput);
            const feedNerfDart = npmauthutils.toNerfDart(feedUrl.href);

            npmrcRegistries = npmrcRegistries.filter(x => npmauthutils.toNerfDart(x) === feedNerfDart);
            if (npmrcRegistries.length === 0) {
                // origin and pathname never include embedded credentials.
                throw new Error(tl.loc("IgnoringRegistry", `${feedUrl.origin}${feedUrl.pathname}`));
            }
        } else {
            tl.debug(tl.loc('Info_ApplyingWifToAllRegistries', npmrcRegistries.length));
        }

        // Each registry mints its own token, so avoid minting twice for the same feed.
        npmrcRegistries = npmrcRegistries.filter((x, i, all) =>
            all.findIndex(y => npmauthutils.toNerfDart(y) === npmauthutils.toNerfDart(x)) === i);

        federatedAccessTokens = await acquireFederatedAccessTokens(
            entraWifServiceConnectionName,
            npmrcRegistries,
            !!feedUrlInput);
    } else if (feedUrlInput) {
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
            const accessToken = federatedAccessTokens.get(registryUrlString);
            if (!accessToken) {
                // Skipped as unverified. Never fall back to other credential sources for it.
                continue;
            }

            // Log only origin and pathname so the raw .npmrc value never reaches the log.
            const registryDisplay = `${registryURL.origin}${registryURL.pathname}`;
            npmauthutils.writeRepositoryOutput(tl.loc("Info_AddingFederatedFeedAuth", entraWifServiceConnectionName, registryDisplay));
            npmauthutils.writeRepositoryOutput(tl.loc("AddingEndpointCredentials", entraWifServiceConnectionName));
            const npmrcEntry: NpmrcCredential = { url: registryUrlString, auth: `${npmauthutils.toNerfDart(registryUrlString)}:_authToken=${accessToken}` };
            writeCredentialEntry(npmrc, npmrcFile, npmrcEntry, registryURL, addedRegistries);
            federatedFeedAuthSuccessCount++;
            npmauthutils.writeRepositoryOutput(tl.loc("Info_SuccessAddingFederatedFeedAuth", registryDisplay));
            continue;
        }
#endif

        if (endpointRegistries.length > 0) {
            const npmrcEntry = npmauthutils.tryResolveFromEndpoints(registryUrlString, endpointRegistries);
            if (npmrcEntry) {
                npmauthutils.writeRepositoryOutput(tl.loc("AddingEndpointCredentials", registryURL.host));
                writeCredentialEntry(npmrc, npmrcFile, npmrcEntry, new URL(npmrcEntry.url), addedRegistries);
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
            writeCredentialEntry(npmrc, npmrcFile, npmrcEntry, new URL(npmrcEntry.url), addedRegistries);
            internalFeedSuccessCount++;
            continue;
        }

        npmauthutils.writeRepositoryOutput(tl.loc("IgnoringRegistry", registryURL.host));
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

#if WIF
/**
 * Verifies each registry and requests its token before anything is written to the .npmrc,
 * so a failure for one registry doesn't leave credentials written to the file.
 * Registries that are not Azure Artifacts feeds never receive a token. If feedUrl is
 * specified and is a non-AA feed, the task fails.
 */
async function acquireFederatedAccessTokens(
    serviceConnectionName: string,
    registries: string[],
    feedUrlProvided: boolean
): Promise<Map<string, string>> {
    const accessTokens = new Map<string, string>();
    for (const registryUrlString of registries) {
        try {
            await verifyAzureArtifactsFeedUrl(registryUrlString, ProtocolType.Npm);
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            if (feedUrlProvided) {
                throw new Error(tl.loc('Error_WifFeedUrlNotVerified', reason));
            }

            // The upstream feed URL verifier does not expose distinct error types.
            // Skip registries that fail verification.
            tl.debug(reason);
            npmauthutils.writeRepositoryOutput(tl.loc('Info_SkippingUnverifiedWifRegistry', new URL(registryUrlString).host));
            continue;
        }

        const federatedCredentials = await getFederatedWorkloadIdentityCredentialsForFeed(
            serviceConnectionName,
            registryUrlString,
            ProtocolType.Npm);

        if (!federatedCredentials) {
            throw new Error(tl.loc('FailedToGetServiceConnectionAuth', serviceConnectionName));
        }

        accessTokens.set(registryUrlString, federatedCredentials.accessToken);
    }
    return accessTokens;
}
#endif

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
