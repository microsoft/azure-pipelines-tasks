import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as url from 'url';
import { configureEntraCredProvider } from "azure-pipelines-tasks-artifacts-common/credentialProviderUtils";
import { installCredProviderToUserProfile, configureCredProvider} from 'azure-pipelines-tasks-artifacts-common/credentialProviderUtils'
import { ProtocolType } from 'azure-pipelines-tasks-artifacts-common/protocols';
import { getPackagingServiceConnections } from 'azure-pipelines-tasks-artifacts-common/serviceConnectionUtils'
import { emitTelemetry } from 'azure-pipelines-tasks-artifacts-common/telemetry'

async function main(): Promise<void> {
    let forceReinstallCredentialProvider = null;
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // Install the credential provider
        forceReinstallCredentialProvider = tl.getBoolInput("forceReinstallCredentialProvider", false);
        await installCredProviderToUserProfile(forceReinstallCredentialProvider);

        const feedUrl = tl.getInput("feedUrl");
        const entraWifServiceConnectionName = tl.getInput("workloadIdentityServiceConnection");

        if (feedUrl && entraWifServiceConnectionName) {
            if (url.parse(feedUrl)) {
                tl.debug(tl.loc("Info_AddingFederatedFeedAuth", entraWifServiceConnectionName, feedUrl));
                await configureEntraCredProvider(ProtocolType.NuGet, feedUrl, entraWifServiceConnectionName);
                console.log(tl.loc("Info_SuccessAddingFederatedFeedAuth", feedUrl));
                return;
            } else {
                throw new Error(tl.loc("Error_FailedToParseFeedUrl", feedUrl));
            }
        }   

        // Configure the credential provider for both same-organization feeds and service connections
        var serviceConnections = getPackagingServiceConnections('nuGetServiceConnections');
        await configureCredProvider(ProtocolType.NuGet, serviceConnections);
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error);
    } finally {
        emitTelemetry("Packaging", "NuGetAuthenticateV1", {
            'NuGetAuthenticate.ForceReinstallCredentialProvider': forceReinstallCredentialProvider
        });
    }
}

main();
