import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { loginAzureRM } from 'azure-pipelines-tasks-artifacts-common/azCliUtils';

export class AzureAuthenticationHelper {

    private sessionLoggedIn: boolean = false;
    private cliPasswordPath: string = null;

    public async loginAzure(connectedService: string): Promise<void> {
        await loginAzureRM(connectedService);

        const authScheme: string = tl.getEndpointAuthorizationScheme(connectedService, true);
        if (authScheme.toLowerCase() === 'serviceprincipal') {
            const authType: string = tl.getEndpointAuthorizationParameter(connectedService, 'authenticationType', true);
            if (authType === 'spnCertificate') {
                this.cliPasswordPath = path.join(tl.getVariable('Agent.TempDirectory') || tl.getVariable('system.DefaultWorkingDirectory'), 'spnCert.pem');
            }
        }

        this.sessionLoggedIn = true;
    }

    public logoutAzure() {
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
    }
}