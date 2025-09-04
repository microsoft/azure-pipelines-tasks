import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { configureEntraCredProvider } from "azure-pipelines-tasks-artifacts-common/credentialProviderUtils";
import { installCredProviderToUserProfile, configureCredProvider, configureCredProviderForSameOrganizationFeeds} from 'azure-pipelines-tasks-artifacts-common/credentialProviderUtils'
import { ProtocolType } from 'azure-pipelines-tasks-artifacts-common/protocols';
import { getPackagingServiceConnections } from 'azure-pipelines-tasks-artifacts-common/serviceConnectionUtils'
import { emitTelemetry } from 'azure-pipelines-tasks-artifacts-common/telemetry'
import { ServiceConnection } from 'azure-pipelines-tasks-artifacts-common/serviceConnectionUtils';

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

        entraWifServiceConnectionName = tl.getInput("workloadIdentityServiceConnection");
        feedUrl = tl.getInput("feedUrl", false);

        // Failure case: User provides inputs for both NuGet & WIF Service Connections
        if (serviceConnections.length > 0 && entraWifServiceConnectionName) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("Error_NuGetWithWIFNotSupported"));
            return;
        }

        // Validate input is valid feed URL
        if (feedUrl && !isValidFeed(feedUrl)) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("Error_InvalidFeedUrl", feedUrl));
            return;
        }

        // Only cross-org feedUrls are supported with Azure Devops service connections. If feedUrl is internal, the task will fail.
        if (entraWifServiceConnectionName && feedUrl ) {
            tl.debug(tl.loc("Info_AddingFederatedFeedAuth", entraWifServiceConnectionName, feedUrl));
            await configureEntraCredProvider(ProtocolType.NuGet, entraWifServiceConnectionName, feedUrl);
            federatedFeedAuthSuccessCount++;    
            console.log(tl.loc("Info_SuccessAddingFederatedFeedAuth", feedUrl));
            
            return;
        } else if (entraWifServiceConnectionName && !feedUrl) {
            // If the user doesn't provide a feedUrl, use the Azure Devops service connection to replace the Build Service
            configureCredProviderForSameOrganizationFeeds(ProtocolType.NuGet, entraWifServiceConnectionName);

            return;
        } else if (feedUrl) {
            // Warning case: User provides feedUrl without providing a WIF service connection
            // In the future, we will shift to breaking behavior
            tl.warning(tl.loc("Warn_IgnoringFeedUrl"));
            feedUrl = null;

            // tl.setResult(tl.TaskResult.SucceededWithIssues, tl.loc("Error_NuGetWithFeedUrlNotSupported"));
        }

        // Configure the credential provider for both same-organization feeds and service connections
        await configureCredProvider(ProtocolType.NuGet, serviceConnections);
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error);
    } finally {
        emitTelemetry("Packaging", "NuGetAuthenticateV1", {
            'NuGetAuthenticate.ForceReinstallCredentialProvider': forceReinstallCredentialProvider,
            "FederatedFeedAuthCount": federatedFeedAuthSuccessCount,
            "isFeedUrlIncluded": !!tl.getInput("feedUrl"),
            "isFeedUrlValid": isValidFeed(tl.getInput("feedUrl")),
            "isEntraWifServiceConnectionNameIncluded": !!entraWifServiceConnectionName,
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
