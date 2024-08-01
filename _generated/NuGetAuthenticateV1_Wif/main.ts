import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { getFederatedWorkloadIdentityCredentials, getFeedTenantId } from "azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils";
import { installCredProviderToUserProfile, configureCredProvider, configureEntraCredProvider } from 'azure-pipelines-tasks-artifacts-common/credentialProviderUtils'
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

        var serviceConnections = [];

        const feedUrl = tl.getInput("feedUrl");
        const entraWifServiceConnectionName = tl.getInput("workloadIdentityServiceConnection");

        if (feedUrl && entraWifServiceConnectionName)
        {
            // Is there a better way to enforce this? 
            if (feedUrl.includes(",") || entraWifServiceConnectionName.includes(",")) {
                throw new Error(tl.loc("MultipleValuesInSingleInput"));
            }

            await configureEntraCredProvider(ProtocolType.NuGet, feedUrl, entraWifServiceConnectionName);
        }
        else
        {
            // Configure the credential provider for both same-organization feeds and service connections
            serviceConnections = getPackagingServiceConnections('nuGetServiceConnections');
            await configureCredProvider(ProtocolType.NuGet, serviceConnections);
        }
    } catch (error) {
        if (error.message.includes("existing service connection"))
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
