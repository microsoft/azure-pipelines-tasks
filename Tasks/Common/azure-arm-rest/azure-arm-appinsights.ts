import msRestAzure = require('./azure-arm-common');
import tl = require('vsts-task-lib/task');
import util = require('util');
import webClient = require('./webClient');
import  {ToError, ServiceClient } from './AzureServiceClient';
import Model = require('./azureModels');
import Q = require('q');
import { AzureEndpoint, ApplicationInsights } from './azureModels';

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
        }, null, '2015-05-01');

        try {
            var response = await this._client.beginRequest(httpRequest);
            if(response.statusCode == 200) {
                return response.body as ApplicationInsights;
            }

            throw ToError(response);
        }
        catch(error) {
            throw Error(tl.loc('FailedToUpdateApplicationInsightsResource', this._name, this._client.getFormattedError(error)))
        }
    }

    public getEndpoint(): AzureEndpoint {
        return this._endpoint;
    }

    public getResourceGroupName(): string {
        return this._resourceGroupName;
    }
}
