import * as taskLib from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as path from 'path';
import { getSystemAccessToken } from 'azure-pipelines-tasks-artifacts-common/webapi';
import { getHandlerFromToken, WebApi } from "azure-devops-node-api";
import { ITaskApi } from "azure-devops-node-api/TaskApi";

export async function getVaultCredentials(): Promise<[{ [key: string]: string }, String]> {
    let connectedService = taskLib.getInput("azurekvServiceConection", true);
    if (!connectedService) {
        console.log(taskLib.loc('NoServiceConnection'));
        return [{}, ""];
    }

    var authScheme = taskLib.getEndpointAuthorizationScheme(connectedService, true);
    if (!authScheme) {
        console.log(taskLib.loc('NoAuthScheme'));
        return [{}, ""];
    }

    let envVariables = {};
    let credentialType = "";
    switch (authScheme.toLocaleLowerCase()) {
        case "managedserviceidentity":
            // azure key vault plugin will automatially try managed idenitty
            console.log(taskLib.loc('UseAuthenticationMethod', 'Managed Identity'));
            credentialType = "managedid";
            break;
        case "serviceprincipal":
            console.log(taskLib.loc('UseAuthenticationMethod', 'Service Principal'));
            let authType = taskLib.getEndpointAuthorizationParameter(connectedService, 'authenticationType', true);
            let cliPassword: string | undefined = "";
            var servicePrincipalId = taskLib.getEndpointAuthorizationParameter(connectedService, "serviceprincipalid", false);
            var tenantId = taskLib.getEndpointAuthorizationParameter(connectedService, "tenantid", false);
            if (authType == "spnCertificate") {
                taskLib.debug('certificate based endpoint');
                let certificateContent = taskLib.getEndpointAuthorizationParameter(connectedService, "servicePrincipalCertificate", false) ?? '';
                let tempDir = taskLib.getVariable('Agent.TempDirectory') || taskLib.getVariable('system.DefaultWorkingDirectory');
                if (!tempDir) {
                    throw new Error(taskLib.loc('TempDirectoryOrWorkingDirectoryNotSet'));
                }
                cliPassword = path.join(tempDir, 'spnCert.pem');
                fs.writeFileSync(cliPassword, certificateContent);
                envVariables = {
                    "AZURE_TENANT_ID": tenantId,
                    "AZURE_CLIENT_ID": servicePrincipalId,
                    "AZURE_CLIENT_CERTIFICATE_PATH": cliPassword,
                }
            }
            else {
                taskLib.debug('key based endpoint');
                cliPassword = taskLib.getEndpointAuthorizationParameter(connectedService, "serviceprincipalkey", false);
                envVariables = {
                    "AZURE_TENANT_ID": tenantId,
                    "AZURE_CLIENT_ID": servicePrincipalId,
                    "AZURE_CLIENT_SECRET": cliPassword,
                }
            }
            credentialType = "environment"
            break;
        case "workloadidentityfederation":
            console.log(taskLib.loc('UseAuthenticationMethod', 'Workload Identity Federation'));
            var servicePrincipalId = taskLib.getEndpointAuthorizationParameter(connectedService, "serviceprincipalid", false);
            var tenantId = taskLib.getEndpointAuthorizationParameter(connectedService, "tenantid", false);
            const federatedToken = await getWorkloadIdToken(connectedService);
            const extractPath = taskLib.getVariable('Agent.TempDirectory');
            if (!extractPath) {
                throw new Error(taskLib.loc('TempDirectoryNotSet'));
            }

            const tokenFile = path.join(extractPath, 'oidcToken');
            fs.writeFileSync(tokenFile, federatedToken);
            envVariables = {
                "AZURE_TENANT_ID": tenantId,
                "AZURE_CLIENT_ID": servicePrincipalId,
                "AZURE_FEDERATED_TOKEN_FILE": tokenFile,
            }
            credentialType = "workloadid"
            break;
        default:
            throw new Error(taskLib.loc('UnsupportedAuthScheme', authScheme));
    }

    return [envVariables, credentialType];
}

async function getWorkloadIdToken(connectedService: string): Promise<string> {
    const jobId = taskLib.getVariable("System.JobId");
    if (!jobId) {
        throw new Error(taskLib.loc('FailedToGetWorkloadIdToken', 'JobId not set'));
    }

    const planId = taskLib.getVariable("System.PlanId");
    if (!planId) {
        throw new Error(taskLib.loc('FailedToGetWorkloadIdToken', 'PlanId not set'));
    }

    const projectId = taskLib.getVariable("System.TeamProjectId");
    if (!projectId) {
        throw new Error(taskLib.loc('FailedToGetWorkloadIdToken', 'ProjectId not set'));
    }

    const hub = taskLib.getVariable("System.HostType");
    if (!hub) {
        throw new Error(taskLib.loc('FailedToGetWorkloadIdToken', 'Hub not set'));
    }

    const uri = taskLib.getVariable("System.CollectionUri");
    if (!uri) {
        throw new Error(taskLib.loc('FailedToGetWorkloadIdToken', 'CollectionUri not set'));
    }

    const token = getSystemAccessToken();
    if (!token) {
        throw new Error(taskLib.loc('FailedToGetWorkloadIdToken', 'Token not set'));
    }

    const authHandler = getHandlerFromToken(token);
    const connection = new WebApi(uri, authHandler);
    const api: ITaskApi = await connection.getTaskApi();
    const response = await api.createOidcToken({}, projectId, hub, planId, jobId, connectedService);
    if (response == null) {
        throw new Error(taskLib.loc('FailedToGetWorkloadIdToken', 'Response is null'));
    }

    if (!response.oidcToken) {
        throw new Error(taskLib.loc('FailedToGetWorkloadIdToken', 'Token not set'));
    }

    return response.oidcToken;
}