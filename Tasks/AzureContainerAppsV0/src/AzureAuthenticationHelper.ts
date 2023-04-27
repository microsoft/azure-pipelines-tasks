import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import { Utility } from './Utility';
import { getHandlerFromToken, WebApi } from "azure-devops-node-api";
import { ITaskApi } from "azure-devops-node-api/TaskApi";

export class AzureAuthenticationHelper {

    private sessionLoggedIn: boolean = false;
    private cliPasswordPath: string = null;

    /**
     * Re-uses the loginAzureRM code implemented by the AzureCLIV2 Azure DevOps Task.
     * https://github.com/microsoft/azure-pipelines-tasks/blob/b82a8e69eb862d1a9d291af70da2e62ee69270df/Tasks/AzureCLIV2/azureclitask.ts#L106-L150
     * @param connectedService - an Azure DevOps Service Connection that can authorize the connection to Azure
     */
     public async loginAzureRM(connectedService: string): Promise<void> {
        const authScheme: string = tl.getEndpointAuthorizationScheme(connectedService, true);
        const subscriptionID: string = tl.getEndpointDataParameter(connectedService, 'SubscriptionID', true);

        if (authScheme.toLowerCase() == "workloadidentityfederation") {
            var servicePrincipalId: string = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalid", false);
            var tenantId: string = tl.getEndpointAuthorizationParameter(connectedService, "tenantid", false);

            const federatedToken = await AzureAuthenticationHelper.getIdToken(connectedService);
            tl.setSecret(federatedToken);
            const args = `login --service-principal -u "${servicePrincipalId}" --tenant "${tenantId}" --allow-no-subscriptions --federated-token "${federatedToken}"`;

            //login using OpenID Connect federation
            new Utility().throwIfError(tl.execSync("az", args), tl.loc("LoginFailed"));
        }
        else if (authScheme.toLowerCase() === 'serviceprincipal') {
            const authType: string = tl.getEndpointAuthorizationParameter(connectedService, 'authenticationType', true);
            let cliPassword: string = null;
            const servicePrincipalId: string = tl.getEndpointAuthorizationParameter(connectedService, 'serviceprincipalid', false);
            const tenantId: string = tl.getEndpointAuthorizationParameter(connectedService, 'tenantid', false);

            if (authType === 'spnCertificate') {
                tl.debug('certificate based endpoint');
                const certificateContent: string = tl.getEndpointAuthorizationParameter(connectedService, 'servicePrincipalCertificate', false);
                cliPassword = path.join(tl.getVariable('Agent.TempDirectory') || tl.getVariable('system.DefaultWorkingDirectory'), 'spnCert.pem');
                fs.writeFileSync(cliPassword, certificateContent);
                this.cliPasswordPath = cliPassword;
            } else {
                tl.debug('key based endpoint');
                cliPassword = tl.getEndpointAuthorizationParameter(connectedService, 'serviceprincipalkey', false);
            }

            const escapedCliPassword = cliPassword.replace(/"/g, '\\"');
            tl.setSecret(escapedCliPassword.replace(/\\/g, '\"'));
            //login using svn
            new Utility().throwIfError(
                tl.execSync('az', `login --service-principal -u "${servicePrincipalId}" --password="${escapedCliPassword}" --tenant "${tenantId}" --allow-no-subscriptions`),
                'Azure login failed');
        } else if (authScheme.toLowerCase() === 'managedserviceidentity') {
            //login using msi
            new Utility().throwIfError(
                tl.execSync('az', 'login --identity'),
                'Azure login failed using Managed Service Identity');
        } else {
            throw `Auth Scheme "${authScheme}" is not supported`;
        }

        this.sessionLoggedIn = true;
        if (!!subscriptionID) {
            //set the subscription imported to the current subscription
            new Utility().throwIfError(
                tl.execSync('az', 'account set --subscription "' + subscriptionID + '"'),
                'Error in setting up subscription');
        }
    }

    /**
     * Re-uses the logoutAzure code implemented by the AzureCLIV2 Azure DevOps Task.
     * https://github.com/microsoft/azure-pipelines-tasks/blob/b82a8e69eb862d1a9d291af70da2e62ee69270df/Tasks/AzureCLIV2/azureclitask.ts#L175-L183
     */
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

    private static async getIdToken(connectedService: string) : Promise<string> {
        const jobId = tl.getVariable("System.JobId");
        const planId = tl.getVariable("System.PlanId");
        const projectId = tl.getVariable("System.TeamProjectId");
        const hub = tl.getVariable("System.HostType");
        const uri = tl.getVariable("System.CollectionUri");
        const token = this.getSystemAccessToken();

        const authHandler = getHandlerFromToken(token);
        const connection = new WebApi(uri, authHandler);
        const api: ITaskApi = await connection.getTaskApi();
        const response = await api.createOidcToken({}, projectId, hub, planId, jobId, connectedService);
        if (response == null) {
            return null;
        }

        return response.oidcToken;
    }

    private static getSystemAccessToken() : string {
        tl.debug('Getting credentials for local feeds');
        const auth = tl.getEndpointAuthorization('SYSTEMVSSCONNECTION', false);
        if (auth.scheme === 'OAuth') {
            tl.debug('Got auth token');
            return auth.parameters['AccessToken'];
        }
        else {
            tl.warning('Could not determine credentials to use');
        }
    }
}