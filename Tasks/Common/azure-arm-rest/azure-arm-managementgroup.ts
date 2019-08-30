import msRestAzure = require('./azure-arm-common');
import azureServiceClient = require('./AzureServiceClient');
import webClient = require('./webClient');
import tl = require('vsts-task-lib/task');
import Q = require('q');

export class ManagementGroupManagementClient extends azureServiceClient.ServiceClient {

    public deployments: Deployments;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, managementGroupId: string, options?: any) {
        super(credentials, "test");
        this.managementGroupId = managementGroupId;

        this.apiVersion = (credentials.isAzureStackEnvironment) ? '2019-05-01' : '2019-05-01';
        this.acceptLanguage = 'en-US';
        this.generateClientRequestId = true;
        if (!!options && !!options.longRunningOperationRetryTimeout) {
            this.longRunningOperationRetryTimeout = options.longRunningOperationRetryTimeout;
        }
        this.deployments = new Deployments(this);
    }
}

export class Deployments {
    private client: ManagementGroupManagementClient;

    constructor(client: ManagementGroupManagementClient) {
        this.client = client;
    }

    public executeManagementGroupScopeDeployment(managementGroupId, deploymentName, parameters, callback) {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
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
            '//providers/Microsoft.Management/managementGroups/{managementGroupId}/providers/Microsoft.Resources/deployments/{deploymentName}',
            {
                '{managementGroupId}': managementGroupId,
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
                            this.get(managementGroupId, deploymentName, (error, response) => {
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

    public get(managementGroupId, deploymentName, callback) {
        // Create HTTP transport objects
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = this.client.getRequestUri(
            '//providers/Microsoft.Management/managementGroups/{managementGroupId}/providers/Microsoft.Resources/deployments/{deploymentName}',
            {
                '{managementGroupId}': managementGroupId,
                '{deploymentName}': deploymentName
            }
        );

        // Send Request and process response.
        this.client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();

            if (response.statusCode != 200) {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public validate(managementGroupId, deploymentName, parameters, callback) {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
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
            '//providers/Microsoft.Management/managementGroups/{managementGroupId}/providers/Microsoft.Resources/deployments/{deploymentName}/validate',
            {
                '{managementGroupId}': managementGroupId,
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