import msRestAzure = require("./azure-arm-common");
import tl = require('vsts-task-lib/task');
import util = require("util");
import webClient = require("./webClient");
import azureServiceClient = require("./AzureServiceClient");
import Model = require("./azureModels");
import Q = require("q");

export class AzureResourceFilterManagementClient extends azureServiceClient.ServiceClient {
    public azureResourceFilter: AzureResourceFilter;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: string, options?: any) {
        super(credentials, subscriptionId);

        if (!!options && !!options.longRunningOperationRetryTimeout) {
            this.longRunningOperationRetryTimeout = options.longRunningOperationRetryTimeout;
        }
        this.azureResourceFilter = new AzureResourceFilter(this);
    }
}

export class AzureResourceFilter {
    private _client: AzureResourceFilterManagementClient;

    constructor(client: AzureResourceFilterManagementClient) {
        this._client = client;
    }

    public getResources(resourceType: string, resourceName: string, options: any, callback: azureServiceClient.ApiCallback) {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        try {
            if(!resourceType || typeof resourceType.valueOf() != 'string') {
                throw new Error(tl.loc('ResourceTypeCannotBeNull'));
            }

            if(!resourceName || typeof resourceName.valueOf() != 'string') {
                throw new Error(tl.loc('ResourceNameCannotBeNull'));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';

        httpRequest.uri = this._client.getRequestUri('//subscriptions/{subscriptionId}/resources', {},
        [`$filter=resourceType EQ \'${resourceType}\' AND name EQ \'${resourceName}\'`], '2016-07-01');

        var result = [];
        this._client.beginRequest(httpRequest).then(async (response: webClient.WebResponse) => {
            if (response.statusCode == 200) {
                if (response.body.value) {
                    result = result.concat(response.body.value);
                }

                if (response.body.nextLink) {
                    var nextResult = await this._client.accumulateResultFromPagedResult(response.body.nextLink);
                    if (nextResult.error) {
                        return new azureServiceClient.ApiResult(nextResult.error);
                    }
                    result = result.concat(nextResult.result);
                }

                return new azureServiceClient.ApiResult(null, result);
            }
            else {
                return new azureServiceClient.ApiResult(azureServiceClient.ToError(response));
            }
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }
}