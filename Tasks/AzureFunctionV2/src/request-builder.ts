import * as tl from 'azure-pipelines-task-lib/task';
import { TaskInputs } from './types';
import { AxiosRequestConfig } from 'axios';
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint';
import { AuthType } from './constants';
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest/azureModels';

export class RequestBuilder {
  constructor(private inputs: TaskInputs) {}

  public async buildRequest(): Promise<AxiosRequestConfig> {
    return this.inputs.authType === AuthType.Key ? this.buildKeyAuthRequest() : await this.buildArmAuthRequest();
  }

  private buildKeyAuthRequest(): AxiosRequestConfig {
    tl.debug(`Building key authentication request for function: ${this.inputs.function}`);
    let url = `${this.inputs.function}?code=${this.inputs.key}`;

    // Add query parameters if present
    if (this.inputs.queryParameters) {
      url += this.inputs.queryParameters;
    }

    // Merge system headers with user-provided headers
    const systemHeaders = this.getDefaultHeaders();
    const headers = {
      ...systemHeaders,
      ...this.inputs.headers // User headers override system headers
    };

    const config: AxiosRequestConfig = {
      url: url,
      method: this.inputs.method,
      headers,
      validateStatus: () => true, // Don't throw for any HTTP status, we'll handle it manually
      data: this.getRequestBody()
    };

    return config;
  }

  private async buildArmAuthRequest(): Promise<AxiosRequestConfig> {
    if (!this.inputs.serviceConnection) {
      throw new Error('Service connection is required for ARM authentication');
    }

    tl.debug(`Building request with ARM authentication using service connection: ${this.inputs.serviceConnection}`);

    try {
      const request = this.buildKeyAuthRequest();

      const endpoint: AzureEndpoint = await new AzureRMEndpoint(this.inputs.serviceConnection).getEndpoint();
      endpoint.applicationTokenCredentials.activeDirectoryResourceId = `api://${endpoint.servicePrincipalClientID}`;
      const token = await endpoint.applicationTokenCredentials.getToken(true);

      // Add token to headers
      request.headers = {
        ...request.headers,
        Authorization: `Bearer ${token}`
      };

      return request;
    } catch (error: any) {
      tl.error(`Error building ARM auth request: ${error.message}`);
      throw error;
    }
  }

  private getDefaultHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      PlanUrl: tl.getVariable('system.CollectionUri') || '',
      ProjectId: tl.getVariable('system.TeamProjectId') || '',
      HubName: tl.getVariable('system.HostType') || '',
      PlanId: tl.getVariable('system.PlanId') || '',
      JobId: tl.getVariable('system.JobId') || '',
      TimelineId: tl.getVariable('system.TimelineId') || '',
      TaskInstanceId: tl.getVariable('system.TaskInstanceId') || '',
      AuthToken: tl.getVariable('system.AccessToken') || ''
    };
  }

  private getRequestBody(): any {
    // Add body for non-GET/HEAD requests
    if (this.inputs.body && this.inputs.method !== 'GET' && this.inputs.method !== 'HEAD') {
      try {
        // Try to parse as JSON first
        return JSON.parse(this.inputs.body);
      } catch (e) {
        // If not JSON, use as-is
        return this.inputs.body;
      }
    }
  }
}
