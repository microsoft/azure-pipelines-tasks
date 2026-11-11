import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { AzureRMLoginCredentials, cleanupAzureRMLoginCredentials, loginAzureRM } from 'azure-pipelines-tasks-azure-arm-rest/azCliUtility';

export class AzureAuthenticationHelper {

    private sessionLoggedIn: boolean = false;
    private cliPasswordPath: string = null;
    private loginCredentials: AzureRMLoginCredentials = null;

    public async loginAzure(connectedService: string): Promise<void> {
        this.loginCredentials = await loginAzureRM(connectedService);

        // Isolated credentials are removed through cleanupAzureRMLoginCredentials instead.
        const authScheme: string = tl.getEndpointAuthorizationScheme(connectedService, true);
        const usesIsolatedCredentials = !!(this.loginCredentials && this.loginCredentials.directoryPath);
        if (!usesIsolatedCredentials && authScheme.toLowerCase() === 'serviceprincipal') {
            const authType: string = tl.getEndpointAuthorizationParameter(connectedService, 'authenticationType', true);
            if (authType === 'spnCertificate') {
                this.cliPasswordPath = path.join(tl.getVariable('Agent.TempDirectory') || tl.getVariable('system.DefaultWorkingDirectory'), 'spnCert.pem');
            }
        }

        this.sessionLoggedIn = true;
    }

    public logoutAzure() {
        try {
            if (this.cliPasswordPath) {
                tl.debug('Removing spn certificate file');
                tl.rmRF(this.cliPasswordPath);
            }

            if (this.sessionLoggedIn) {
                tl.debug('Attempting to log out from Azure');
                try {
                    tl.execSync('az', ' account clear');
                } catch (err) {
                    // task should not fail if logout doesn`t occur
                    tl.warning(`The following error occurred while logging out: ${err.message}`);
                }
            }
        } finally {
            // Azure CLI reads the certificate on every command, so remove it only after logout.
            cleanupAzureRMLoginCredentials(this.loginCredentials);
            this.loginCredentials = null;
        }
    }
}