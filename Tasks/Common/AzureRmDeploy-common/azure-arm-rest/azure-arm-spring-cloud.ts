import tl = require('azure-pipelines-task-lib/task');
import webClient = require('./webClient');

import {
    AzureEndpoint
} from './azureModels'

import {
    ServiceClient,
    ToError
} from './AzureServiceClient';
import constants = require('./constants');

export class AzureSpringCloud {
    private _resourceGroup: string;
    private _serviceName: string;
    private _client: ServiceClient;

    constructor(endpoint: AzureEndpoint, resourceGroup: string, serviceName: string) {
        this._client = new ServiceClient(endpoint.applicationTokenCredentials, endpoint.subscriptionID, 30);
        this._resourceGroup = resourceGroup;
        this._serviceName = serviceName;
    }

    public async deployApplication(appName: string, deploymentName?: string, artifactToUpload: string): Promise<void> {
        //Get deployment URL
        var deploymentUrl = this.getDeploymentUrl
    }

    protected async getDeploymentUrl(appName: string, deploymentName?: string): Promise<string> {

        try{
            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'GET';
            httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AppPlatform/Spring/{serviceName}/apps/{appName}/getResourceUploadUrl`,{
                resourceGroupName: this._resourceGroup,
                serviceName: this._serviceName
            }, null, '2019-05-01-preview');
            var response = await this._client.beginRequest(httpRequest);
            if(response.statusCode != 200){
                throw ToError(response);
            }
            return response.body;
            
        } catch (error){
            throw Error(tl.loc('UnableToGetDeploymentUrl', this._getFormattedName(),this._client.getFormattedError(error)));
        }
    }

    private _getFormattedName(): string {
        return `${this._resourceGroup}/${this._name}`; 
    }
}