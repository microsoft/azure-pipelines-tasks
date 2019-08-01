import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { installCredProviderToUserProfile, configureCredProvider } from 'artifacts-common/credentialProviderUtils'
import { ProtocolType } from 'artifacts-common/protocols';
import { getPackagingServiceConnections } from 'artifacts-common/serviceConnectionUtils'
import { emitTelemetry } from 'artifacts-common/telemetry'

async function main(): Promise<void> {
    let forceReinstallCredentialProvider = null;
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));
        tl.setResourcePath(path.join(__dirname, 'node_modules/artifacts-common/module.json'));

        // Install the credential provider
        forceReinstallCredentialProvider = tl.getBoolInput("forceReinstallCredentialProvider", false);
        await installCredProviderToUserProfile(forceReinstallCredentialProvider);

        // Configure the credential provider for both same-organization feeds and service connections
        const serviceConnections = getPackagingServiceConnections('nuGetServiceConnections');
        await configureCredProvider(ProtocolType.NuGet, serviceConnections);
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error);
    } finally {
        emitTelemetry("Packaging", "NuGetAuthenticate", {
            'NuGetAuthenticate.ForceReinstallCredentialProvider': forceReinstallCredentialProvider
        });
    }
}

main();