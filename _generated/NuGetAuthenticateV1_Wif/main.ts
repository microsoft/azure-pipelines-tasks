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


        feedUrl = tl.getInput("feedUrl");
        entraWifServiceConnectionName = tl.getInput("workloadIdentityServiceConnection");
        serviceConnections = getPackagingServiceConnections('nuGetServiceConnections');

        // Failure case: User provides inputs for both NuGet & WIF Service Connections
        if (serviceConnections.length > 0 && entraWifServiceConnectionName) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("Error_NuGetWithWIFNotSupported"));
            return;
        }

        // Warning case: User provides feedUrl without providing a WIF service connection 
        // In the future, we will shift to breaking behavior
        if (entraWifServiceConnectionName) {
            // Happy path, continue with flow
        } else if (feedUrl) {
            tl.warning(tl.loc("Warn_IgnoringFeedUrl"));
            feedUrl = null;
            // tl.setResult(tl.TaskResult.SucceededWithIssues, tl.loc("Error_NuGetWithFeedUrlNotSupported"));
        }

        // Validate input is valid feed URL
        if (feedUrl && !validateFeedUrl(feedUrl)) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("Error_InvalidFeedUrl", feedUrl));
        }

        // Install the credential provider
        forceReinstallCredentialProvider = tl.getBoolInput("forceReinstallCredentialProvider", false);
        await installCredProviderToUserProfile(forceReinstallCredentialProvider);

        // Only cross-org feedUrls are supported with Azure Devops service connections. If feedUrl is internal, the task will fail.
        if (entraWifServiceConnectionName && feedUrl ) {
            tl.debug(tl.loc("Info_AddingFederatedFeedAuth", entraWifServiceConnectionName, feedUrl));
            await configureEntraCredProvider(ProtocolType.NuGet, entraWifServiceConnectionName, feedUrl);
            federatedFeedAuthSuccessCount++;    
            console.log(tl.loc("Info_SuccessAddingFederatedFeedAuth", feedUrl));
            
            return;
        }
        // If the user doesn't provide a feedUrl, use the Azure Devops service connection to replace the Build Service
        else if (entraWifServiceConnectionName && !feedUrl) {
            configureCredProviderForSameOrganizationFeeds(ProtocolType.NuGet, entraWifServiceConnectionName);
            return;
        }


        // Configure the credential provider for both same-organization feeds and service connections
        serviceConnections = getPackagingServiceConnections('nuGetServiceConnections');
        await configureCredProvider(ProtocolType.NuGet, serviceConnections);
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error);
    } finally {
        emitTelemetry("Packaging", "NuGetAuthenticateV1", {
            'NuGetAuthenticate.ForceReinstallCredentialProvider': forceReinstallCredentialProvider,
            "FederatedFeedAuthCount": federatedFeedAuthSuccessCount,
            "isFeedUrlIncluded": !!tl.getInput("feedUrl"),
            "isFeedUrlValid": validateFeedUrl(tl.getInput("feedUrl")),
            "isEntraWifServiceConnectionNameIncluded": !!entraWifServiceConnectionName,
            "isServiceConnectionIncluded": !!serviceConnections.length
        });
    }
}

/**
 * Validates that the feedUrl is a valid Azure DevOps feed URL.
 * Returns true if the feedUrl is valid, false otherwise.
 */
function validateFeedUrl(feedUrl: string): boolean {
    return !!feedUrl && /^https:\/\/(dev\.azure\.com|[\w-]+\.visualstudio\.com)\/[\w-]+\/_packaging\/[\w-]+\/nuget\/v3\/index\.json$/i.test(feedUrl);
}

main();
