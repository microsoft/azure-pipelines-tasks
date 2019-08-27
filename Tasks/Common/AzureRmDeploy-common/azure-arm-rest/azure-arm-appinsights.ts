import tl = require('azure-pipelines-task-lib/task');
import webClient = require('./webClient');
import  {ToError, ServiceClient } from './AzureServiceClient';
import { AzureEndpoint, ApplicationInsights } from './azureModels';
import { APIVersions } from './constants';

export class AzureApplicationInsights {
    private _name: string;
    private _resourceGroupName: string;
    private _endpoint: AzureEndpoint;
    private _client: ServiceClient;

    constructor(endpoint: AzureEndpoint, resourceGroupName: string, name: string) {
        this._client = new ServiceClient(endpoint.applicationTokenCredentials, endpoint.subscriptionID, 30);
        this._endpoint = endpoint;
        this._resourceGroupName = resourceGroupName;
        this._name = name;
    }

    public async get(): Promise<ApplicationInsights> {
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';

        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/microsoft.insights/components/{resourceName}`,
        {
            '{resourceGroupName}': this._resourceGroupName,
            '{resourceName}': this._name,
        }, null, '2015-05-01');

        try {
            var response = await this._client.beginRequest(httpRequest);
            if(response.statusCode == 200) {
                return response.body as ApplicationInsights;
            }

            throw ToError(response);
        }
        catch(error) {
            throw Error(tl.loc('FailedToGetApplicationInsightsResource', this._name, this._client.getFormattedError(error)))
        }
    }

    public async update(insightProperties: any): Promise<ApplicationInsights> {
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.body = JSON.stringify(insightProperties);
        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/microsoft.insights/components/{resourceName}`,
        {
            '{resourceGroupName}': this._resourceGroupName,
            '{resourceName}': this._name,
        }, null, APIVersions.azure_arm_appinsights);

        try {
            var response = await this._client.beginRequest(httpRequest);
            if(response.statusCode == 200 || response.statusCode == 201) {
                return response.body as ApplicationInsights;
            }

            throw ToError(response);
        }
        catch(error) {
            throw Error(tl.loc('FailedToUpdateApplicationInsightsResource', this._name, this._client.getFormattedError(error)))
        }
    }

    public async addReleaseAnnotation(annotation: any): Promise<void> {
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.body = JSON.stringify(annotation);
        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/microsoft.insights/components/{resourceName}/Annotations`,
        {
            '{resourceGroupName}': this._resourceGroupName,
            '{resourceName}': this._name,
        }, null, APIVersions.azure_arm_appinsights);

        try {
            var response = await this._client.beginRequest(httpRequest);
            tl.debug(`addReleaseAnnotation. Data : ${JSON.stringify(response)}`);
            if(response.statusCode == 200 || response.statusCode == 201) {
                return ;
            }

            throw ToError(response);
        }
        catch(error) {
            throw Error(tl.loc('FailedToUpdateApplicationInsightsResource', this._name, this._client.getFormattedError(error)))
        }
    }

    public getResourceGroupName(): string {
        return this._resourceGroupName;
    }
}


export class ApplicationInsightsResources {
    private _endpoint: AzureEndpoint;
    private _client: ServiceClient;

    constructor(endpoint: AzureEndpoint) {
        this._client = new ServiceClient(endpoint.applicationTokenCredentials, endpoint.subscriptionID, 30);
        this._endpoint = endpoint;
    }

    public async list(resourceGroupName?: string, filter?: string[]): Promise<ApplicationInsights[]> {
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        resourceGroupName = resourceGroupName ? `resourceGroups/${resourceGroupName}` : ''; 
        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/${resourceGroupName}/providers/microsoft.insights/components`,
        {}, filter, APIVersions.azure_arm_appinsights);

        try {
            var response = await this._client.beginRequest(httpRequest);
            if(response.statusCode == 200) {
                var responseBody = response.body;
                var applicationInsightsResources: ApplicationInsights[] = [];
                if(responseBody.value && responseBody.value.length > 0) {
                    for(var value of responseBody.value) {
                        applicationInsightsResources.push(value as ApplicationInsights);
                    }
                }

                return applicationInsightsResources;

            }

            throw ToError(response);
        }
        catch(error) {
            throw Error(tl.loc('FailedToGetApplicationInsightsResource', this._client.getFormattedError(error)))
        }

    }
}