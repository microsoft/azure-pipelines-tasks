import * as tl from 'azure-pipelines-task-lib/task';
import { AzureRMLoginCredentials, cleanupAzureRMLoginCredentials, loginAzureRM } from 'azure-pipelines-tasks-azure-arm-rest/azCliUtility';
import { createPerInvocationAzureConfigDir, removePerInvocationAzureConfigDir } from './azureConfigDir';

export class AzureAuthenticationHelper {
    private sessionLoggedIn: boolean = false;
    private loginCredentials: AzureRMLoginCredentials | undefined;
    private azureConfigDir: string | null = null;

    public async loginAzure(connectedService: string): Promise<void> {
        const agentTempDir = tl.getVariable('Agent.TempDirectory');
        if (!!agentTempDir) {
            // Create an unpredictable per-invocation directory so concurrent tasks
            // on the same host don't share ~/.azure, where one task's
            // `az account clear` can invalidate another's in-flight credential.
            this.azureConfigDir = createPerInvocationAzureConfigDir(agentTempDir);
            console.log(tl.loc('SettingAzureConfigDir', this.azureConfigDir));
        } else {
            tl.debug('Agent.TempDirectory not set; skipping AZURE_CONFIG_DIR isolation');
        }

        // Keep the returned credential files until after the last az command; see logoutAzure.
        this.loginCredentials = await loginAzureRM(connectedService);

        this.sessionLoggedIn = true;
    }

    public logoutAzure(): void {
        try {
            // Logout of Azure if logged in
            if (this.sessionLoggedIn) {
                tl.debug('Logging out from Azure CLI');
                try {
                    tl.execSync('az', 'account clear');
                } catch (err) {
                    // Task should not fail if logout doesn't occur
                    tl.warning(tl.loc('FailedToLogout', err.message));
                }
            }

            // Azure CLI reads the certificate on every command, so remove login credential
            // files only after the last az call. The helper never throws.
            cleanupAzureRMLoginCredentials(this.loginCredentials);
            this.loginCredentials = undefined;
        } finally {
            // Must run AFTER `az account clear` so it still sees the per-invocation
            // profile. Removing it earlier would unset AZURE_CONFIG_DIR and cause `az`
            // to mutate the agent's global profile. In `finally` so an earlier cleanup
            // failure can't leak the directory; the helper itself never throws.
            if (this.azureConfigDir) {
                removePerInvocationAzureConfigDir(this.azureConfigDir);
                this.azureConfigDir = null;
            }
        }
    }
}