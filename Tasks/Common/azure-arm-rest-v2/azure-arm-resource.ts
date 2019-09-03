import { AzureEndpoint } from './azureModels';
import msRestAzure = require('./azure-arm-common');
import azureServiceClient = require('./AzureServiceClient');
import azureServiceClientBase = require('./AzureServiceClientBase');
import depolymentsBase = require('./DeploymentsBase');
import webClient = require('./webClient');
import tl = require('azure-pipelines-task-lib/task');
import Q = require('q');

export class ResourceManagementClient extends azureServiceClient.ServiceClient {

    public deployments: ResourceDeployments;
    public resourceGroups: ResourceGroups;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: string, options?: any) {
        super(credentials, subscriptionId);

        this.apiVersion = (credentials.isAzureStackEnvironment) ? '2016-06-01' : '2017-05-10';
        this.acceptLanguage = 'en-US';
        this.generateClientRequestId = true;
        if (!!options && !!options.longRunningOperationRetryTimeout) {
            this.longRunningOperationRetryTimeout = options.longRunningOperationRetryTimeout;
        }
        this.resourceGroups = new ResourceGroups(this);
        this.deployments = new ResourceDeployments(this);
    }
}

export class Resources {
    private _client: azureServiceClient.ServiceClient;

    constructor(endpoint: AzureEndpoint) {
        this._client = new azureServiceClient.ServiceClient(endpoint.applicationTokenCredentials, endpoint.subscriptionID, 30);
    }

    public async getResources(resourceType: string, resourceName: string) {
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';

        httpRequest.uri = this._client.getRequestUri('//subscriptions/{subscriptionId}/resources', {},
            [`$filter=resourceType EQ \'${encodeURIComponent(resourceType)}\' AND name EQ \'${encodeURIComponent(resourceName)}\'`], '2016-07-01');

        var result = [];
        try {
            var response = await this._client.beginRequest(httpRequest);
            if (response.statusCode != 200) {
                throw azureServiceClientBase.ToError(response);
            }

            result = result.concat(response.body.value);
            if (response.body.nextLink) {
                var nextResult = await this._client.accumulateResultFromPagedResult(response.body.nextLink);
                if (nextResult.error) {
                    throw Error(nextResult.error);
                }
                result = result.concat(nextResult.result);
            }

            return result;
        }
        catch (error) {
            throw Error(tl.loc('FailedToGetResourceID', resourceType, resourceName, this._client.getFormattedError(error)))
        }
    }
}

export class ResourceGroups {
    private client: ResourceManagementClient;

    constructor(armClient: ResourceManagementClient) {
        this.client = armClient;
    }

    public checkExistence(resourceGroupName: string, callback: azureServiceClientBase.ApiCallback): void {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
        } catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'HEAD';
        httpRequest.uri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}',
            {
                '{resourceGroupName}': resourceGroupName
            }
        );

        // Send Request and process response.
        this.client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClientBase.ApiResult>();
            if (response.statusCode == 204 || response.statusCode == 404) {
                deferred.resolve(new azureServiceClientBase.ApiResult(null, response.statusCode == 204));
            }
            else {
                deferred.resolve(new azureServiceClientBase.ApiResult(azureServiceClientBase.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClientBase.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public deleteMethod(resourceGroupName: string, callback: azureServiceClientBase.ApiCallback) {
        var client = this.client;
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
        } catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'DELETE';
        httpRequest.uri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}',
            {
                '{resourceGroupName}': resourceGroupName
            }
        );

        this.client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClientBase.ApiResult>();
            var statusCode = response.statusCode;
            if (statusCode !== 202 && statusCode !== 200) {
                deferred.resolve(new azureServiceClientBase.ApiResult(azureServiceClientBase.ToError(response)));
            }
            else {
                // Create Result
                this.client.getLongRunningOperationResult(response).then((response: webClient.WebResponse) => {
                    if (response.statusCode == 200) {
                        deferred.resolve(new azureServiceClientBase.ApiResult(null, response.body));
                    }
                    else {
                        deferred.resolve(new azureServiceClientBase.ApiResult(azureServiceClientBase.ToError(response)));
                    }
                }, (error) => deferred.reject(error));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClientBase.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public createOrUpdate(resourceGroupName: string, parameters, callback: azureServiceClientBase.ApiCallback) {

        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
            if (parameters === null || parameters === undefined) {
                throw new Error(tl.loc("ParametersCannotBeNull"));
            }
        } catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.headers = {};
        httpRequest.uri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}',
            {
                '{resourceGroupName}': resourceGroupName,
            }
        );

        // Serialize Request
        if (parameters !== null && parameters !== undefined) {
            httpRequest.body = JSON.stringify(parameters);
        }

        // Send Request
        this.client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClientBase.ApiResult>();
            var statusCode = response.statusCode;
            if (statusCode !== 200 && statusCode !== 201) {
                deferred.resolve(new azureServiceClientBase.ApiResult(azureServiceClientBase.ToError(response)));
            }
            else {
                deferred.resolve(new azureServiceClientBase.ApiResult(null, response.body));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClientBase.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }
}

export class ResourceDeployments extends depolymentsBase.DeploymentsBase {
    
    protected client: ResourceManagementClient;

    constructor(client: ResourceManagementClient) {
        super(client);
        this.client = client;
    }

    public createOrUpdate(resourceGroupName, deploymentName, deploymentParameters, callback) {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
        } catch (error) {
            return callback(error);
        }

        // Create HTTP request uri
        var requestUri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/providers/Microsoft.Resources/deployments/{deploymentName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{deploymentName}': deploymentName
            }
        );
        super.createOrUpdate(requestUri, deploymentName, deploymentParameters, callback);
    }

    public validate(resourceGroupName, deploymentName, deploymentParameters, callback) {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
        } catch (error) {
            return callback(error);
        }

        // Create HTTP request uri
        var requestUri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/providers/Microsoft.Resources/deployments/{deploymentName}/validate',
            {
                '{resourceGroupName}': resourceGroupName,
                '{deploymentName}': deploymentName
            }
        );
        super.validate(requestUri, deploymentName, deploymentParameters, callback);
    }
}