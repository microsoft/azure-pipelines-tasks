import azureServiceClientBase = require('./AzureServiceClientBase');
import webClient = require('./webClient');
import tl = require('azure-pipelines-task-lib/task');
import Q = require('q');
import path = require('path');

tl.setResourcePath(path.join(__dirname, 'module.json'), true);

export abstract class DeploymentsBase {
    protected client: azureServiceClientBase.AzureServiceClientBase;

    constructor(client: azureServiceClientBase.AzureServiceClientBase) {
        this.client = client;
    }

    public abstract createOrUpdate(deploymentName, deploymentParameters, callback);

    public abstract validate(deploymentName, deploymentParameters, callback);

    public getDeploymentResult(requestUri, callback) {
        // Create HTTP transport objects
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = requestUri;

        // Send Request and process response.
        this.client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClientBase.ApiResult>();
            if (response.statusCode != 200) {
                deferred.resolve(new azureServiceClientBase.ApiResult(azureServiceClientBase.ToError(response)));
            }
            else {
                deferred.resolve(new azureServiceClientBase.ApiResult(null, response.body));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClientBase.ApiResult) =>
            callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    protected deployTemplate(requestUri, deploymentName, deploymentParameters, callback) {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
            if (deploymentName === null || deploymentName === undefined || typeof deploymentName.valueOf() !== 'string') {
                throw new Error(tl.loc("DeploymentNameCannotBeNull"));
            }
            if (deploymentParameters === null || deploymentParameters === undefined) {
                throw new Error(tl.loc("ParametersCannotBeNull"));
            }
        } catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.headers = {};
        httpRequest.uri = requestUri;

        // Serialize Request
        if (deploymentParameters !== null && deploymentParameters !== undefined) {
            httpRequest.body = JSON.stringify(deploymentParameters);
        }

        // Send Request
        this.client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            return new Promise<azureServiceClientBase.ApiResult>((resolve, reject) => {
                var statusCode = response.statusCode;
                if (statusCode !== 200 && statusCode !== 201) {
                    resolve(new azureServiceClientBase.ApiResult(azureServiceClientBase.ToError(response)));
                }
                else {
                    this.client.getLongRunningOperationResult(response)
                        .then((operationResponse) => {
                            this.getDeploymentResult(requestUri, (error, response) => {

                                if (error) {
                                    resolve(new azureServiceClientBase.ApiResult(error));
                                }
                                else {
                                    if (!response.properties) {
                                        reject(new Error(tl.loc("ResponseNotValid")));
                                    }
                                    else if (response.properties.provisioningState === "Succeeded") {
                                        resolve(new azureServiceClientBase.ApiResult(null, response));
                                    } else {
                                        resolve(new azureServiceClientBase.ApiResult(response.properties.error));
                                    }
                                }
                            });
                        }).catch((error) => reject(error));
                }
            });
        }).then((apiResult: azureServiceClientBase.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    protected validateTemplate(requestUri, deploymentName, deploymentParameters, callback) {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
            if (deploymentName === null || deploymentName === undefined || typeof deploymentName.valueOf() !== 'string') {
                throw new Error(tl.loc("DeploymentNameCannotBeNull"));
            }
            if (deploymentParameters === null || deploymentParameters === undefined) {
                throw new Error(tl.loc("ParametersCannotBeNull"));
            }
        } catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.headers = {};
        httpRequest.uri = requestUri;

        // Serialize Request
        if (deploymentParameters !== null && deploymentParameters !== undefined) {
            httpRequest.body = JSON.stringify(deploymentParameters);
        }

        // Send Request
        this.client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            return new Promise<azureServiceClientBase.ApiResult>((resolve, reject) => {
                var statusCode = response.statusCode;
                if (statusCode !== 200 && statusCode !== 400) {
                    resolve(new azureServiceClientBase.ApiResult(azureServiceClientBase.ToError(response)));
                }
                else {
                    resolve(new azureServiceClientBase.ApiResult(null, response.body));
                }
            });
        }).then((apiResult: azureServiceClientBase.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }
}