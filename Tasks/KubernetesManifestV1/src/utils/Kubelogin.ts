
import taskLib = require("azure-pipelines-task-lib/task");

import fs = require("fs");
import path = require("path");

export class Kubelogin {
    private toolPath: string;
    constructor(required: boolean) {
        this.toolPath = taskLib.which(this.getTool(), required);
    }

    public getToolPath(): string {
        return this.toolPath;
    }

    private getTool(): string {
        return "kubelogin";
    }

    public async login(connectedService: string) {
        var authScheme: string = taskLib.getEndpointAuthorizationScheme(connectedService, true);
        var subscriptionID: string = taskLib.getEndpointDataParameter(connectedService, "SubscriptionID", true);

        if (authScheme.toLowerCase() == "workloadidentityfederation") {
            var servicePrincipalId: string = taskLib.getEndpointAuthorizationParameter(connectedService, "serviceprincipalid", false);
            var tenantId: string = taskLib.getEndpointAuthorizationParameter(connectedService, "tenantid", false);
        }
        else if (authScheme.toLowerCase() == "serviceprincipal") {
            let authType: string = taskLib.getEndpointAuthorizationParameter(connectedService, 'authenticationType', true);
            let servicePrincipalKey: string = null;
            var servicePrincipalId: string = taskLib.getEndpointAuthorizationParameter(connectedService, "serviceprincipalid", false);
            var tenantId: string = taskLib.getEndpointAuthorizationParameter(connectedService, "tenantid", false);

            if (authType == "spnCertificate") {
                taskLib.debug('certificate based endpoint');
                let certificateContent: string = taskLib.getEndpointAuthorizationParameter(connectedService, "servicePrincipalCertificate", false);
                servicePrincipalKey = path.join(taskLib.getVariable('Agent.TempDirectory') || taskLib.getVariable('system.DefaultWorkingDirectory'), 'spnCert.pem');
                fs.writeFileSync(servicePrincipalKey, certificateContent);
            }
            else {
                taskLib.debug('key based endpoint');
                servicePrincipalKey = taskLib.getEndpointAuthorizationParameter(connectedService, "serviceprincipalkey", false);
            }

            let escapedCliPassword = servicePrincipalKey.replace(/"/g, '\\"');
            taskLib.setSecret(escapedCliPassword.replace(/\\/g, '\"'));
            //login using svn
            const kubectlTool = taskLib.tool(this.toolPath);
            kubectlTool.arg('convert-kubeconfig');
            kubectlTool.arg(['-l', 'spn',  '--client-id', servicePrincipalId, '--client-secret', escapedCliPassword, '--tenant-id', tenantId, '--v', '20']);
            await kubectlTool.exec();
        }
        else if (authScheme.toLowerCase() == "managedserviceidentity") {
            const kubectlTool = taskLib.tool(this.toolPath);
            kubectlTool.arg('convert-kubeconfig');
            kubectlTool.arg(['-l', 'msi']);
            await kubectlTool.exec();
        }
    }
}