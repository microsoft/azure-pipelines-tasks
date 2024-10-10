import { ToError, ServiceClient } from './AzureServiceClient';
import { AzureEndpoint } from './azureModels';
import msRestAzure = require('./azure-arm-common');
import azureServiceClient = require('./AzureServiceClient');
import webClient = require('./webClient');
import tl = require('azure-pipelines-task-lib/task');
import Q = require('q');

export class ResourceManagementClient extends azureServiceClient.ServiceClient {

    public deployments: Deployments;
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
        this.deployments = new Deployments(this);
    }
}

export class Resources {
    private _client: ServiceClient;

    constructor(endpoint: AzureEndpoint) {
        this._client = new ServiceClient(endpoint.applicationTokenCredentials, endpoint.subscriptionID, 30);
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
                throw ToError(response);
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

    public checkExistence(resourceGroupName: string, callback: azureServiceClient.ApiCallback): void {
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
            return new Promise<azureServiceClient.ApiResult>((resolve, reject) => {
                if (response.statusCode == 204 || response.statusCode == 404) {
                    resolve(new azureServiceClient.ApiResult(null, response.statusCode == 204));
                }
                else {
                    resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
                }
            });
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public deleteMethod(resourceGroupName: string, callback: azureServiceClient.ApiCallback) {
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
            return new Promise<azureServiceClient.ApiResult>((resolve, reject) => {
                var statusCode = response.statusCode;
                if (statusCode !== 202 && statusCode !== 200) {
                    resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
                }
                else {
                    // Create Result
                    this.client.getLongRunningOperationResult(response).then((response: webClient.WebResponse) => {
                        if (response.statusCode == 200) {
                            resolve(new azureServiceClient.ApiResult(null, response.body));
                        }
                        else {
                            resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
                        }
                    }, (error) => reject(error));
                }
            });
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public createOrUpdate(resourceGroupName: string, parameters, callback: azureServiceClient.ApiCallback) {
        var client = this.client;
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
            return new Promise<azureServiceClient.ApiResult>((resolve, reject) => {
                var statusCode = response.statusCode;
                if (statusCode !== 200 && statusCode !== 201) {
                    resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
                }
                else {
                    resolve(new azureServiceClient.ApiResult(null, response.body));
                }
            });
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }
}

export class Deployments {
    private client: ResourceManagementClient;

    constructor(client: ResourceManagementClient) {
        this.client = client;
    }

    public createOrUpdate(resourceGroupName, deploymentName, parameters, callback) {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
            if (deploymentName === null || deploymentName === undefined || typeof deploymentName.valueOf() !== 'string') {
                throw new Error(tl.loc("DeploymentNameCannotBeNull"));
            }
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
            '//subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/providers/Microsoft.Resources/deployments/{deploymentName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{deploymentName}': deploymentName
            }
        );

        // Serialize Request
        if (parameters !== null && parameters !== undefined) {
            httpRequest.body = JSON.stringify(parameters);
        }

        // Send Request
        this.client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            return new Promise<azureServiceClient.ApiResult>((resolve, reject) => {
                var statusCode = response.statusCode;
                if (statusCode !== 200 && statusCode !== 201) {
                    resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
                }
                else {
                    this.client.getLongRunningOperationResult(response)
                        .then((operationResponse) => {
                            this.get(resourceGroupName, deploymentName, (error, response) => {
                                if (error) {
                                    resolve(new azureServiceClient.ApiResult(error));
                                }
                                else {
                                    if (!response.properties) {
                                        reject(new Error(tl.loc("ResponseNotValid")));
                                    }
                                    else if (response.properties.provisioningState === "Succeeded") {
                                        resolve(new azureServiceClient.ApiResult(null, response));
                                    } else {
                                        resolve(new azureServiceClient.ApiResult(response.properties.error));
                                    }
                                }
                            });
                        }).catch((error) => reject(error));
                }
            });
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public get(resourceGroupName, deploymentName, callback) {
        // Create HTTP transport objects
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/providers/Microsoft.Resources/deployments/{deploymentName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{deploymentName}': deploymentName
            }
        );

        // Send Request and process response.
        this.client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            return new Promise<azureServiceClient.ApiResult>((resolve, reject) => {
                if (response.statusCode != 200) {
                    resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
                }
                else {
                    resolve(new azureServiceClient.ApiResult(null, response.body));
                }
            });
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public validate(resourceGroupName, deploymentName, parameters, callback) {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
            if (deploymentName === null || deploymentName === undefined || typeof deploymentName.valueOf() !== 'string') {
                throw new Error(tl.loc("DeploymentNameCannotBeNull"));
            }
            if (parameters === null || parameters === undefined) {
                throw new Error(tl.loc("ParametersCannotBeNull"));
            }
        } catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.headers = {};
        httpRequest.uri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/providers/Microsoft.Resources/deployments/{deploymentName}/validate',
            {
                '{resourceGroupName}': resourceGroupName,
                '{deploymentName}': deploymentName
            }
        );

        // Serialize Request
        if (parameters !== null && parameters !== undefined) {
            httpRequest.body = JSON.stringify(parameters);
        }

        // Send Request
        this.client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            return new Promise<azureServiceClient.ApiResult>((resolve, reject) => {
                var statusCode = response.statusCode;
                if (statusCode !== 200 && statusCode !== 400) {
                    resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
                }
                else {
                    resolve(new azureServiceClient.ApiResult(null, response.body));
                }
            });
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }
}