import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { installCredProviderToUserProfile, configureCredProvider, configureCredProviderForSameOrganizationFeeds} from 'azure-pipelines-tasks-artifacts-common/credentialProviderUtils'
import { ProtocolType } from 'azure-pipelines-tasks-artifacts-common/protocols';
import { getPackagingServiceConnections } from 'azure-pipelines-tasks-artifacts-common/serviceConnectionUtils'
import { emitTelemetry } from 'azure-pipelines-tasks-artifacts-common/telemetry'

async function main(): Promise<void> {
    let forceReinstallCredentialProvider = null;
    let federatedFeedAuthSuccessCount: number = 0;

    var feedUrl;
    var entraWifServiceConnectionName;
    var serviceConnections;

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // Install the credential provider
        forceReinstallCredentialProvider = tl.getBoolInput("forceReinstallCredentialProvider", false);
        await installCredProviderToUserProfile(forceReinstallCredentialProvider);

        serviceConnections = getPackagingServiceConnections('nuGetServiceConnections');

        // Configure the credential provider for both same-organization feeds and service connections
        await configureCredProvider(ProtocolType.NuGet, serviceConnections);
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error);
    } finally {
        emitTelemetry("Packaging", "NuGetAuthenticateV1", {
            'NuGetAuthenticate.ForceReinstallCredentialProvider': forceReinstallCredentialProvider,
            "FederatedFeedAuthCount": federatedFeedAuthSuccessCount,
            // We have to check both input names because only WIF versions of the task are aware of aliases 
            "isFeedUrlIncluded": !!tl.getInput("feedUrl"),
            "isFeedUrlValid": isValidFeed(tl.getInput("feedUrl")),
            "isEntraWifServiceConnectionNameIncluded": !!(tl.getInput("workloadIdentityServiceConnection")|| tl.getInput("azureDevOpsServiceConnection")),
            "isServiceConnectionIncluded": !!serviceConnections.length
        });
    }
}

/**
 * Validates that the feedUrl is a valid Azure DevOps feed URL.
 * Returns true if the feedUrl is valid, false otherwise.
 */
function isValidFeed(feedUrl?: string | null): boolean {
    if (!feedUrl) return false;
    const normalized = feedUrl.trim().replace(/^[\u2018\u2019\u201C\u201D'"]|['"\u2018\u2019\u201C\u201D]$/g, '');

    const feedRegex = /^https:\/\/(?:[\w.-]+\.)?(?:dev\.azure\.com|visualstudio\.com|vsts\.me|codedev\.ms|devppe\.azure\.com|codeapp\.ms)(?:\/[^\/]+(?:\/[^\/]+)?)?\/_packaging\/[^\/]+\/nuget\/v3\/index\.json\/?$/i;

    return feedRegex.test(normalized);
}

main();
