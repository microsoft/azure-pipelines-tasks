import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { loginAzureRM } from 'azure-pipelines-tasks-azure-arm-rest/azCliUtility';

export class AzureAuthenticationHelper {
    private sessionLoggedIn: boolean = false;
    private cliPasswordPath: string = null;

    public async loginAzure(connectedService: string): Promise<void> {
        await loginAzureRM(connectedService);

        // Track certificate path for cleanup if using certificate-based auth
        const authScheme: string = tl.getEndpointAuthorizationScheme(connectedService, true);
        if (authScheme.toLowerCase() === 'serviceprincipal') {
            const authType: string = tl.getEndpointAuthorizationParameter(connectedService, 'authenticationType', true);
            if (authType === 'spnCertificate') {
                this.cliPasswordPath = path.join(
                    tl.getVariable('Agent.TempDirectory') || tl.getVariable('system.DefaultWorkingDirectory'),
                    'spnCert.pem'
                );
            }
        }

        this.sessionLoggedIn = true;
    }

    public logoutAzure(): void {
        // Clean up certificate file if created
        if (this.cliPasswordPath) {
            tl.debug('Removing spn certificate file');
            tl.rmRF(this.cliPasswordPath);
        }

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
    }
}