import msRestAzure = require("./azure-arm-common");
import tl = require('vsts-task-lib/task');
import util = require("util");
import webClient = require("./webClient");
import azureServiceClient = require("./AzureServiceClient");
import Model = require("./azureModels");
import Q = require("q");


export class AppInsightsWebTestsManagementClient extends azureServiceClient.ServiceClient {
    public appInsights: AppInsightsWebTests;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: string, options?: any) {
        super(credentials, subscriptionId);

        if (!!options && !!options.longRunningOperationRetryTimeout) {
            this.longRunningOperationRetryTimeout = options.longRunningOperationRetryTimeout;
        }

        this.appInsights = new AppInsightsWebTests(this);
    }
}

export class AppInsightsWebTests {
    private _client: AppInsightsWebTestsManagementClient;
    
    constructor(client) {
        this._client = client;
    }

    public listByResourceGroup(resourceGroup: string, options: any, callback: azureServiceClient.ApiCallback) {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        try {
            this._client.isValidResourceGroupName(resourceGroup);
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        
        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/microsoft.insights/webtests`,
        {
            '{resourceGroupName}': resourceGroup
        }, null, '2015-05-01');

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

    public create(resourceGroupName: string, webTestName: string, webTestDefinition: any, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }

        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!webTestName || typeof webTestName.valueOf() != 'string') {
                throw new Error(tl.loc("TestNameCannotBeNull"));
            }
            if(webTestDefinition == null || webTestDefinition == undefined) {
                throw new Error(tl.loc("TestDefinitionCannotBeNull"));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.body = JSON.stringify(webTestDefinition);
        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/microsoft.insights/webtests/{webTestName}`,
        {
            '{resourceGroupName}': resourceGroupName,
            '{webTestName}': webTestName
        }, null, '2015-05-01');

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                tl.debug(JSON.stringify(response));
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

}
