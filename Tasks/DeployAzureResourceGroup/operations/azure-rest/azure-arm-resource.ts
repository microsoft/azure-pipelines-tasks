import msRestAzure = require("./ms-rest-azure");
import azureServiceClient = require("./AzureServiceClient");
import util = require("util");
import tl = require('vsts-task-lib/task');
import Q = require("q");

export class ResourceManagementClient extends azureServiceClient.ServiceClient {

    public deployments: Deployments;
    public resourceGroups: ResourceGroups;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: string) {
        super(credentials, subscriptionId);

        this.apiVersion = '2016-07-01';
        this.acceptLanguage = 'en-US';
        this.generateClientRequestId = true;

        this.resourceGroups = new ResourceGroups(this);
        this.deployments = new Deployments(this);
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
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'HEAD';
        httpRequest.uri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}',
            {
                '{resourceGroupName}': resourceGroupName
            }
        );

        // Send Request and process response.
        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            if (response.statusCode == 204 || response.statusCode == 404) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.statusCode == 204));
            }
            else {
                deferred.reject(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public deleteMethod(resourceGroupName, callback) {
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
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'DELETE';
        httpRequest.uri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}',
            {
                '{resourceGroupName}': resourceGroupName
            }
        );

        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            var statusCode = response.statusCode;
            if (statusCode !== 202 && statusCode !== 200) {
                deferred.reject(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }

            // Create Result
            this.client.getLongRunningOperationResult(response).then((response: azureServiceClient.WebResponse) => {
                if (response.statusCode == 200) {
                    deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
                }
                else {
                    deferred.reject(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
                }
            });
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public createOrUpdate(resourceGroupName, parameters, callback) {
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
        var httpRequest = new azureServiceClient.WebRequest();
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
        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            var statusCode = response.statusCode;
            if (statusCode !== 200 && statusCode !== 201) {
                deferred.reject(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            return deferred.promise;
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
        var httpRequest = new azureServiceClient.WebRequest();
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
        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            return new Promise<azureServiceClient.ApiResult>((resolve, reject) => {
                var statusCode = response.statusCode;
                if (statusCode !== 200 && statusCode !== 201) {
                    resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
                }
                else {
                    this.client.getLongRunningOperationResult(response).then((operationResponse) => {
                        this.get(resourceGroupName, deploymentName, (error, response) => {
                            if (error) {
                                resolve(new azureServiceClient.ApiResult(error));
                            } else {
                                if (response.properties.provisioningState === "Succeeded") {
                                    resolve(new azureServiceClient.ApiResult(null, response));
                                } else {
                                    resolve(new azureServiceClient.ApiResult(response.properties.error));
                                }
                            }
                        });
                    });
                }
            });
        }).then((apiResult: azureServiceClient.ApiResult) => callback(null, apiResult.result),
            (apiResult: azureServiceClient.ApiResult) => callback(apiResult.error));
    }

    public get(resourceGroupName, deploymentName, callback) {
        // Create HTTP transport objects
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/providers/Microsoft.Resources/deployments/{deploymentName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{deploymentName}': deploymentName
            }
        );

        // Send Request and process response.
        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();

            if (response.statusCode != 200) {
                deferred.reject(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            return deferred.promise;
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
        var httpRequest = new azureServiceClient.WebRequest();
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
        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            console.log(response);
            return new Promise<azureServiceClient.ApiResult>((resolve, reject) => {
                var statusCode = response.statusCode;
                if (statusCode !== 200 && statusCode !== 400) {
                    reject(new azureServiceClient.ApiResult(azureServiceClient.ToError(response.body)));
                }
                else {
                    resolve(new azureServiceClient.ApiResult(null, response.body));
                }
            });
        }).then((apiResult: azureServiceClient.ApiResult) => callback(null, apiResult.result),
            (apiResult: azureServiceClient.ApiResult) => callback(apiResult.error));
    }
}