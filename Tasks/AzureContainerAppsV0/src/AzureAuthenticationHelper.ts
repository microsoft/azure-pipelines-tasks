import path = require("path");
import tl = require("azure-pipelines-task-lib/task");
import fs = require("fs");
import { Utility } from "./Utility";

export class AzureAuthenticationHelper {

    private sessionLoggedIn: boolean = false;
    private cliPasswordPath: string = null;

    /**
     * Re-uses the loginAzureRM code implemented by the AzureCLIV2 Azure DevOps Task.
     * https://github.com/microsoft/azure-pipelines-tasks/blob/b82a8e69eb862d1a9d291af70da2e62ee69270df/Tasks/AzureCLIV2/azureclitask.ts#L106-L150
     * @param connectedService - an Azure DevOps Service Connection that can authorize the connection to Azure
     */
     public loginAzureRM(connectedService: string): void {
        var authScheme: string = tl.getEndpointAuthorizationScheme(connectedService, true);
        var subscriptionID: string = tl.getEndpointDataParameter(connectedService, "SubscriptionID", true);

        if(authScheme.toLowerCase() == "serviceprincipal") {
            var authType: string = tl.getEndpointAuthorizationParameter(connectedService, 'authenticationType', true);
            var cliPassword: string = null;
            var servicePrincipalId: string = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalid", false);
            var tenantId: string = tl.getEndpointAuthorizationParameter(connectedService, "tenantid", false);

            if (authType == "spnCertificate") {
                tl.debug('certificate based endpoint');
                var certificateContent: string = tl.getEndpointAuthorizationParameter(connectedService, "servicePrincipalCertificate", false);
                cliPassword = path.join(tl.getVariable('Agent.TempDirectory') || tl.getVariable('system.DefaultWorkingDirectory'), 'spnCert.pem');
                fs.writeFileSync(cliPassword, certificateContent);
                this.cliPasswordPath = cliPassword;
            }
            else {
                tl.debug('key based endpoint');
                cliPassword = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalkey", false);
            }

            var escapedCliPassword = cliPassword.replace(/"/g, '\\"');
            tl.setSecret(escapedCliPassword.replace(/\\/g, '\"'));
            //login using svn
            new Utility().throwIfError(
                tl.execSync("az", `login --service-principal -u "${servicePrincipalId}" --password="${escapedCliPassword}" --tenant "${tenantId}" --allow-no-subscriptions`),
                "Azure login failed");
        }
        else if(authScheme.toLowerCase() == "managedserviceidentity") {
            //login using msi
            new Utility().throwIfError(
                tl.execSync("az", "login --identity"),
                "Azure login failed using Managed Service Identity");
        }
        else{
            throw `Auth Scheme "${authScheme}" is not supported`;
        }

        this.sessionLoggedIn = true;
        if(!!subscriptionID) {
            //set the subscription imported to the current subscription
            new Utility().throwIfError(
                tl.execSync("az", "account set --subscription \"" + subscriptionID + "\""),
                "Error in setting up subscription");
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
            tl.debug("Attempting to log out from Azure");
            try {
                tl.execSync("az", " account clear");
            }
            catch (err) {
                // task should not fail if logout doesn`t occur
                tl.warning(`The following error occurred while logging out: ${err.message}`);
            }
        }
    }
}