
import taskLib = require("azure-pipelines-task-lib/task");

import fs = require("fs");
import path = require("path");

import { getHandlerFromToken, WebApi } from "azure-devops-node-api";
import { ITaskApi } from "azure-devops-node-api/TaskApi";

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
            const kubectaskLibTool = taskLib.tool(this.toolPath);
            kubectaskLibTool.arg('convert-kubeconfig');
            kubectaskLibTool.arg(['-l', 'spn',  '--client-id', servicePrincipalId, '--client-secret', escapedCliPassword, '--tenant-id', tenantId, '--v', '20']);
            await kubectaskLibTool.exec();
        }
        else if (authScheme.toLowerCase() == "managedserviceidentity") {
            const kubectaskLibTool = taskLib.tool(this.toolPath);
            kubectaskLibTool.arg('convert-kubeconfig');
            kubectaskLibTool.arg(['-l', 'msi']);
            await kubectaskLibTool.exec();
        }
    }

    private static async getIdToken(connectedService: string) : Promise<string> {
        const jobId = taskLib.getVariable("System.JobId");
        const planId = taskLib.getVariable("System.PlanId");
        const projectId = taskLib.getVariable("System.TeamProjectId");
        const hub = taskLib.getVariable("System.HostType");
        const uri = taskLib.getVariable("System.CollectionUri");
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
        taskLib.debug('Getting credentials for local feeds');
        const auth = taskLib.getEndpointAuthorization('SYSTEMVSSCONNECTION', false);
        if (auth.scheme === 'OAuth') {
            taskLib.debug('Got auth token');
            return auth.parameters['AccessToken'];
        }
        else {
            taskLib.warning('Could not determine credentials to use');
        }
    }
}