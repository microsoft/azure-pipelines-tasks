import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as url from 'url';
#if WIF
import { configureEntraCredProvider } from "azure-pipelines-tasks-artifacts-common/credentialProviderUtils";
#endif
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

#if WIF
        const feedUrl = tl.getInput("feedUrl");
        const entraWifServiceConnectionName = tl.getInput("workloadIdentityServiceConnection");

        // Skip configuring service connections if we are using feed url and wif service connection
        if (feedUrl && entraWifServiceConnectionName) 
        {
            try {
                const parsedUrl = url.parse(feedUrl);
                tl.debug(tl.loc("Info_AddingFederatedFeedAuth", entraWifServiceConnectionName, parsedUrl));
                await configureEntraCredProvider(ProtocolType.NuGet, parsedUrl, entraWifServiceConnectionName);
                console.log(tl.loc("Info_SuccessAddingFederatedFeedAuth", parsedUrl));
                return;
            } catch (error) {
                console.log(error); // => TypeError, "Failed to construct URL: Invalid URL"
            }
        }
#endif

        // Configure the credential provider for both same-organization feeds and service connections
        var serviceConnections = getPackagingServiceConnections('nuGetServiceConnections');
        await configureCredProvider(ProtocolType.NuGet, serviceConnections);

    } catch (error) {
        if (error.message.includes(tl.loc("Error_ServiceConnectionExists")))
            tl.setResult(tl.TaskResult.SucceededWithIssues, error.message);
        else
            tl.setResult(tl.TaskResult.Failed, error);
    } finally {
        emitTelemetry("Packaging", "NuGetAuthenticateV1", {
            'NuGetAuthenticate.ForceReinstallCredentialProvider': forceReinstallCredentialProvider
        });
    }
}

main();
