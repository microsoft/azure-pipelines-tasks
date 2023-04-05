import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { installCredProviderToUserProfile, configureCredProvider } from 'azure-pipelines-tasks-artifacts-common/credentialProviderUtils'
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

        // Configure the credential provider for both same-organization feeds and service connections
        const serviceConnections = getPackagingServiceConnections('nuGetServiceConnections');
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