import { AzureEndpoint } from './azureModels';
import msRestAzure = require('./azure-arm-common');
import azureServiceClient = require('./AzureServiceClient');
import azureServiceClientBase = require('./AzureServiceClientBase');
import depolymentsBase = require('./DeploymentsBase');
import webClient = require('./webClient');
import tl = require('azure-pipelines-task-lib/task');
import Q = require('q');
import path = require('path');

tl.setResourcePath(path.join(__dirname, 'module.json'), true);

export class ResourceManagementClient extends azureServiceClient.ServiceClient {

    public resourceGroup: ResourceGroup;
    public resourceGroupName: string;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, resourceGroupName: string, subscriptionId: string, options?: any) {
        super(credentials, subscriptionId);

        this.apiVersion = (credentials.isAzureStackEnvironment) ? '2016-06-01' : '2021-04-01';
        this.acceptLanguage = 'en-US';
        this.generateClientRequestId = true;
        if (!!options && !!options.longRunningOperationRetryTimeout) {
            this.longRunningOperationRetryTimeout = options.longRunningOperationRetryTimeout;
        }
        this.resourceGroupName = resourceGroupName;
        this.resourceGroup = new ResourceGroup(this);
        this.deployments = new ResourceGroupDeployments(this);
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

export class ResourceGroup {
    private client: ResourceManagementClient;

    constructor(armClient: ResourceManagementClient) {
        this.client = armClient;
    }

    public checkExistence(callback: azureServiceClientBase.ApiCallback): void {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
            this.client.isValidResourceGroupName(this.client.resourceGroupName);
        } catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'HEAD';
        httpRequest.uri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}',
            {
                '{resourceGroupName}': this.client.resourceGroupName
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

    public deleteMethod(callback: azureServiceClientBase.ApiCallback) {
        var client = this.client;
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
            this.client.isValidResourceGroupName(this.client.resourceGroupName);
        } catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'DELETE';
        httpRequest.uri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}',
            {
                '{resourceGroupName}': this.client.resourceGroupName
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

    public createOrUpdate(parameters, callback: azureServiceClientBase.ApiCallback) {

        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
            this.client.isValidResourceGroupName(this.client.resourceGroupName);
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
                '{resourceGroupName}': this.client.resourceGroupName,
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

export class ResourceGroupDeployments extends depolymentsBase.DeploymentsBase {

    protected client: ResourceManagementClient;

    constructor(client: ResourceManagementClient) {
        super(client);
        this.client = client;
    }

    public createOrUpdate(deploymentName, deploymentParameters, callback) {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
            this.client.isValidResourceGroupName(this.client.resourceGroupName);
        } catch (error) {
            return callback(error);
        }

        // Create HTTP request uri
        var requestUri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/providers/Microsoft.Resources/deployments/{deploymentName}',
            {
                '{resourceGroupName}': this.client.resourceGroupName,
                '{deploymentName}': deploymentName
            }
        );
        super.deployTemplate(requestUri, deploymentName, deploymentParameters, callback);
    }

    public validate(deploymentName, deploymentParameters, callback) {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
            this.client.isValidResourceGroupName(this.client.resourceGroupName);
        } catch (error) {
            return callback(error);
        }

        // Create HTTP request uri
        var requestUri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/providers/Microsoft.Resources/deployments/{deploymentName}/validate',
            {
                '{resourceGroupName}': this.client.resourceGroupName,
                '{deploymentName}': deploymentName
            }
        );
        super.validateTemplate(requestUri, deploymentName, deploymentParameters, callback);
    }
}