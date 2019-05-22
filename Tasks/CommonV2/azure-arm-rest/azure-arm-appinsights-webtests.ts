import { ToError, ServiceClient } from './AzureServiceClient';
import msRestAzure = require('./azure-arm-common');
import tl = require('azure-pipelines-task-lib/task');
import util = require('util');
import webClient = require('./webClient');
import Model = require('./azureModels');
import Q = require('q');
import { AzureEndpoint, WebTest } from './azureModels';

export class ApplicationInsightsWebTests {
    private _resourceGroupName: string;
    private _client: ServiceClient;

    constructor(endpoint: AzureEndpoint, resourceGroup: string) {
        this._client = new ServiceClient(endpoint.applicationTokenCredentials, endpoint.subscriptionID, 30);
        this._resourceGroupName = resourceGroup;
    }

    public async list(): Promise<Array<WebTest>> {
        let httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        
        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/microsoft.insights/webtests`,
        {
            '{resourceGroupName}': this._resourceGroupName
        }, null, '2015-05-01');

        let result: Array<WebTest> = [];

        try {
            let response = await this._client.beginRequest(httpRequest);
            if(response.statusCode != 200) {
                throw ToError(response);
            }

            result = result.concat(response.body.value);
            if(response.body.nextLink) {
                let nextResult = await this._client.accumulateResultFromPagedResult(response.body.nextLink);
                if(nextResult.error) {
                    throw ToError(nextResult.error);
                }
                result = result.concat(nextResult.result);
            }
            tl.debug(`retrieved list of tests for ${this._resourceGroupName}.`);
            return result;
        }
        catch(error) {
            throw Error(tl.loc('FailedToGetApplicationInsightsWebTestsForResourceGroup', this._resourceGroupName, this._client.getFormattedError(error)));
        }
    }

    public async create(webTestData: WebTest): Promise<WebTest> {
        
        let httpRequest = new webClient.WebRequest();
        httpRequest.method = 'PUT';
        
        httpRequest.body = JSON.stringify(webTestData);
        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/microsoft.insights/webtests/{webTestName}`,
        {
            '{resourceGroupName}': this._resourceGroupName,
            '{webTestName}': webTestData.name
        }, null, '2015-05-01');

        try {
            let response = await this._client.beginRequest(httpRequest);
            if(response.statusCode != 200 && response.statusCode != 201) {
                throw ToError(response);
            }

            tl.debug(`added web test ${response.body.name}.`);
            return response.body as WebTest;

        }
        catch(error) {
            throw Error(tl.loc("FailedToCreateWebTests", this._client.getFormattedError(error)));
        }
    }
}