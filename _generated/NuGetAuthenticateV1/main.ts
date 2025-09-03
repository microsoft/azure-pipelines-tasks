import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
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
