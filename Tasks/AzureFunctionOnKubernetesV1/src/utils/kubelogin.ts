import taskLib = require('azure-pipelines-task-lib/task');
import toolRunner = require('azure-pipelines-task-lib/toolrunner');

import fs = require('fs');
import path = require('path');

import { IRequestHandler } from 'azure-devops-node-api/interfaces/common/VsoBaseInterfaces';
import { getHandlerFromToken, WebApi } from 'azure-devops-node-api';
import { ITaskApi } from 'azure-devops-node-api/TaskApi';
import { TaskHubOidcToken } from 'azure-devops-node-api/interfaces/TaskAgentInterfaces';

export class Kubelogin {
  private toolPath: string;
  private userDir: string;
  private available: boolean;

  constructor(userDir: string) {
    try {
      this.toolPath = taskLib.which('kubelogin', true);
      this.available = true;
    } catch (err) {
      this.toolPath = '';
      this.available = false;
    }
    this.userDir = userDir;
  }

  public isAvailable(): boolean {
    return this.available;
  }

  public async login(connectedService: string) {
    const authScheme: string = taskLib.getEndpointAuthorizationScheme(connectedService, true);

    taskLib.debug(`Kubelogin authentication scheme ${authScheme}`);

    if (authScheme.toLowerCase() == 'workloadidentityfederation') {
      const servicePrincipalId: string = taskLib.getEndpointAuthorizationParameter(connectedService, 'serviceprincipalid', false);
      const tenantId: string = taskLib.getEndpointAuthorizationParameter(connectedService, 'tenantid', false);

      const token: string = await Kubelogin.getIdToken(connectedService);

      const idTokenFile: string = path.join(this.userDir, 'id_token');
      fs.writeFileSync(idTokenFile, token);

      process.env['AZURE_CLIENT_ID'] = servicePrincipalId;
      process.env['AZURE_TENANT_ID'] = tenantId;
      process.env['AZURE_FEDERATED_TOKEN_FILE'] = idTokenFile;
      process.env['AZURE_AUTHORITY_HOST'] = 'https://login.microsoftonline.com/';

      const kubectaskLibTool: toolRunner.ToolRunner = taskLib.tool(this.toolPath);
      kubectaskLibTool.arg('convert-kubeconfig');
      kubectaskLibTool.arg(['-l', 'workloadidentity']);
      if (taskLib.getVariable('System.Debug')) {
        kubectaskLibTool.arg(['--v', '20']);
      }
      await kubectaskLibTool.exec();
    } else if (authScheme.toLowerCase() == 'serviceprincipal') {
      const authType: string = taskLib.getEndpointAuthorizationParameter(connectedService, 'authenticationType', true);
      let servicePrincipalKey: string = null;
      const servicePrincipalId: string = taskLib.getEndpointAuthorizationParameter(connectedService, 'serviceprincipalid', false);
      const tenantId: string = taskLib.getEndpointAuthorizationParameter(connectedService, 'tenantid', false);

      if (authType == 'spnCertificate') {
        taskLib.debug('certificate based endpoint');
        let certificateContent: string = taskLib.getEndpointAuthorizationParameter(connectedService, 'servicePrincipalCertificate', false);
        servicePrincipalKey = path.join(taskLib.getVariable('Agent.TempDirectory') || taskLib.getVariable('system.DefaultWorkingDirectory'), 'spnCert.pem');
        fs.writeFileSync(servicePrincipalKey, certificateContent);
      } else {
        taskLib.debug('key based endpoint');
        servicePrincipalKey = taskLib.getEndpointAuthorizationParameter(connectedService, 'serviceprincipalkey', false);
      }

      let escapedCliPassword: string = servicePrincipalKey.replace(/"/g, '\\"');
      taskLib.setSecret(escapedCliPassword.replace(/\\/g, '"'));

      const kubectaskLibTool: toolRunner.ToolRunner = taskLib.tool(this.toolPath);
      kubectaskLibTool.arg('convert-kubeconfig');
      kubectaskLibTool.arg(['-l', 'spn', '--client-id', servicePrincipalId, '--client-secret', escapedCliPassword, '--tenant-id', tenantId]);
      if (taskLib.getVariable('System.Debug')) {
        kubectaskLibTool.arg(['--v', '20']);
      }
      await kubectaskLibTool.exec();
    } else if (authScheme.toLowerCase() == 'managedserviceidentity') {
      const kubectaskLibTool: toolRunner.ToolRunner = taskLib.tool(this.toolPath);
      kubectaskLibTool.arg('convert-kubeconfig');
      kubectaskLibTool.arg(['-l', 'msi']);
      if (taskLib.getVariable('System.Debug')) {
        kubectaskLibTool.arg(['--v', '20']);
      }
      await kubectaskLibTool.exec();
    } else {
      throw taskLib.loc('AuthSchemeNotSupported', authScheme);
    }
  }

  private static async getIdToken(connectedService: string): Promise<string> {
    const jobId: string = taskLib.getVariable('System.JobId');
    const planId: string = taskLib.getVariable('System.PlanId');
    const projectId: string = taskLib.getVariable('System.TeamProjectId');
    const hub: string = taskLib.getVariable('System.HostType');
    const uri: string = taskLib.getVariable('System.CollectionUri');
    const token: string = this.getSystemAccessToken();

    const authHandler: IRequestHandler = getHandlerFromToken(token);
    const connection: WebApi = new WebApi(uri, authHandler);
    const api: ITaskApi = await connection.getTaskApi();
    const response: TaskHubOidcToken = await api.createOidcToken({}, projectId, hub, planId, jobId, connectedService);
    if (response == null) {
      return null;
    }

    return response.oidcToken;
  }

  private static getSystemAccessToken(): string {
    taskLib.debug('Getting credentials for local feeds');
    const auth: taskLib.EndpointAuthorization = taskLib.getEndpointAuthorization('SYSTEMVSSCONNECTION', false);
    if (auth.scheme === 'OAuth') {
      taskLib.debug('Got auth token');
      return auth.parameters['AccessToken'];
    } else {
      taskLib.warning('Could not determine credentials to use');
    }
  }
}
