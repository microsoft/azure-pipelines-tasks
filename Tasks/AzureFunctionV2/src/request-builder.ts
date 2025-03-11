import * as tl from 'azure-pipelines-task-lib/task';
import { TaskInputs, FunctionRequest } from './types';
import { AxiosRequestConfig } from 'axios';
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint';
import { AuthType } from './constants';
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest/azureModels';
import fs = require('fs');
import util = require('util');

export class RequestBuilder {
  constructor(private inputs: TaskInputs) {}

  public async buildRequest(): Promise<FunctionRequest> {
    return this.inputs.authType === AuthType.Key ? this.buildKeyAuthRequest() : await this.buildArmAuthRequest();
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

  private buildBaseRequest(): FunctionRequest {
    tl.debug(`Building base request for function: ${this.inputs.function}`);
    let url = this.inputs.function;

    // Merge system headers with user-provided headers
    const systemHeaders = this.getDefaultHeaders();
    const headers = {
      ...systemHeaders,
      ...this.inputs.headers // User headers override system headers
    };

    const config: AxiosRequestConfig = {
      method: this.inputs.method,
      headers,
      validateStatus: () => true // Don't throw for any HTTP status, we'll handle it manually
    };

    // Add query parameters if present
    if (this.inputs.queryParameters) {
      url += (url.includes('?') ? '&' : '?') + this.inputs.queryParameters;
    }

    // Add body for non-GET/HEAD requests
    if (this.inputs.body && this.inputs.method !== 'GET' && this.inputs.method !== 'HEAD') {
      try {
        // Try to parse as JSON first
        config.data = JSON.parse(this.inputs.body);
      } catch (e) {
        // If not JSON, use as-is
        config.data = this.inputs.body;
      }
    }

    return { url, config };
  }

  private buildKeyAuthRequest(): FunctionRequest {
    tl.debug('Building request with function key authentication');

    const request = this.buildBaseRequest();

    // Append function key to URL
    if (this.inputs.key) {
      request.url += (request.url.includes('?') ? '&' : '?') + `code=${this.inputs.key}`;
    } else {
      tl.warning('Function key is empty. This may cause authentication failure.');
    }

    return request;
  }

  private async buildArmAuthRequest(): Promise<FunctionRequest> {
    if (!this.inputs.serviceConnection) {
      throw new Error('Service connection is required for ARM authentication');
    }

    tl.debug(`Building request with ARM authentication using service connection: ${this.inputs.serviceConnection}`);

    try {
      const request = this.buildBaseRequest();

      const endpoint: AzureEndpoint = await new AzureRMEndpoint(this.inputs.serviceConnection).getEndpoint();      
      const token1 = await endpoint.applicationTokenCredentials.getToken(true);
      
      const writeFile = util.promisify(fs.writeFile);
      await writeFile('token1.txt', JSON.stringify(token1, null, 2));

      endpoint.applicationTokenCredentials.activeDirectoryResourceId = 'api://c37bd201-5912-4abd-bfdb-8ee6b06d7408'
      const token2 = await endpoint.applicationTokenCredentials.getToken(true);

      await writeFile('token2.txt', JSON.stringify(token2, null, 2));     
      
      await writeFile('endpoint.txt', JSON.stringify(endpoint, null, 2));     

      // Add token to headers
      request.config.headers = {
        ...request.config.headers,
        Authorization: `Bearer ${token2}`
      };

      return request;
    } catch (error: any) {
      tl.error(`Error building ARM auth request: ${error.message}`);
      throw error;
    }
  }
}
