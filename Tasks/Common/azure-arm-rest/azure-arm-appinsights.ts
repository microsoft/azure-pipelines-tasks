import msRestAzure = require("./azure-arm-common");
import tl = require('vsts-task-lib/task');
import util = require("util");
import webClient = require("./webClient");
import azureServiceClient = require("./AzureServiceClient");
import Model = require("./azureModels");
import Q = require("q");


export class AppInsightsManagementClient extends azureServiceClient.ServiceClient {
    public appInsights: AppInsights;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: string, options?: any) {
        super(credentials, subscriptionId);

        if (!!options && !!options.longRunningOperationRetryTimeout) {
            this.longRunningOperationRetryTimeout = options.longRunningOperationRetryTimeout;
        }

        this.appInsights = new AppInsights(this);
    }
}

export class AppInsights {
    private _client: AppInsightsManagementClient;
    
    constructor(client) {
        this._client = client;
    }

    public async get(resourceGroupName: string, resourceName: string, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }

        if (!callback) {
            throw new Error('callback cannot be null.');    
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!resourceName || typeof resourceName.valueOf() != 'string') {
                throw new Error(tl.loc('ResourceNameCannotBeNull'));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/microsoft.insights/components/{resourceName}`,
        {
            '{resourceGroupName}': resourceGroupName,
            '{resourceName}': resourceName,
        }, null, '2015-05-01');

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
        (error) => callback(error));
    }

    public async update(resourceGroupName: string, resourceName: string, insightProperties: any, options, callback: azureServiceClient.ApiCallback) {
       if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
       }

       if (!callback) {
            throw new Error('callback cannot be null.');
       }

       try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!resourceName || typeof resourceName.valueOf() != 'string') {
                throw new Error(tl.loc('ResourceNameCannotBeNull'));
            }
            if(!insightProperties) {
                throw new Error(tl.loc("AppInsightsPropertiesCannotBeNullOrEmpty"));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.body = JSON.stringify(insightProperties);
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/microsoft.insights/components/{resourceName}`,
        {
            '{resourceGroupName}': resourceGroupName,
            '{resourceName}': resourceName,
        }, null, '2015-05-01');

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
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
