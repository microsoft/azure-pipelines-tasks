import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { configureEntraCredProvider } from "azure-pipelines-tasks-artifacts-common/credentialProviderUtils";
import { installCredProviderToUserProfile, configureCredProvider, configureCredProviderForSameOrganizationFeeds} from 'azure-pipelines-tasks-artifacts-common/credentialProviderUtils'
import { ProtocolType } from 'azure-pipelines-tasks-artifacts-common/protocols';
import { getPackagingServiceConnections } from 'azure-pipelines-tasks-artifacts-common/serviceConnectionUtils'
import { emitTelemetry } from 'azure-pipelines-tasks-artifacts-common/telemetry'

async function main(): Promise<void> {
    let forceReinstallCredentialProvider = null;
    let federatedFeedAuthSuccessCount: number = 0;
// test
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // Install the credential provider
        forceReinstallCredentialProvider = tl.getBoolInput("forceReinstallCredentialProvider", false);
        await installCredProviderToUserProfile(forceReinstallCredentialProvider);

        const feedUrl = tl.getInput("feedUrl");
        const entraWifServiceConnectionName = tl.getInput("workloadIdentityServiceConnection");

        // Only cross-org feedUrls are supported with Azure Devops service connections. If feedUrl is internal, the task will fail.
        if (feedUrl && entraWifServiceConnectionName) {
            tl.debug(tl.loc("Info_AddingFederatedFeedAuth", entraWifServiceConnectionName, feedUrl));
            await configureEntraCredProvider(ProtocolType.NuGet, entraWifServiceConnectionName, feedUrl);
            federatedFeedAuthSuccessCount++;    
            console.log(tl.loc("Info_SuccessAddingFederatedFeedAuth", feedUrl));
            
            return;
        }
        // If the user doesn't provide a feedUrl, use the Azure Devops service connection to replace the Build Service
        else if (!feedUrl && entraWifServiceConnectionName) {
            configureCredProviderForSameOrganizationFeeds(ProtocolType.NuGet, entraWifServiceConnectionName);
            return;
        }  
        else if (feedUrl) {
            throw new Error(tl.loc("Error_MissingFeedUrlOrServiceConnection"));
        }

        // Configure the credential provider for both same-organization feeds and service connections
        var serviceConnections = getPackagingServiceConnections('nuGetServiceConnections');
        await configureCredProvider(ProtocolType.NuGet, serviceConnections);
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error);
    } finally {
        emitTelemetry("Packaging", "NuGetAuthenticateV1", {
            'NuGetAuthenticate.ForceReinstallCredentialProvider': forceReinstallCredentialProvider,
            "FederatedFeedAuthCount": federatedFeedAuthSuccessCount
        });
    }
}

main();
