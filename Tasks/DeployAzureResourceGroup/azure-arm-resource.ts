import msRestAzure = require("./ms-rest-azure");
import azureServiceClient = require("./AzureServiceClient");
import util = require("util");

export class ResourceManagementClient extends azureServiceClient.ServiceClient {
    private longRunningOperationRetryTimeout;
    private generateClientRequestId;
    private subscriptionId;
    private baseUri;
    private apiVersion;
    private acceptLanguage;

    public deployments;
    public resourceGroups;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: string) {
        super(credentials);
        this.apiVersion = '2016-07-01';
        this.acceptLanguage = 'en-US';
        this.longRunningOperationRetryTimeout = 30;
        this.generateClientRequestId = true;
        if (credentials === null || credentials === undefined) {
            throw new Error('\'credentials\' cannot be null.');
        }
        if (subscriptionId === null || subscriptionId === undefined) {
            throw new Error('\'subscriptionId\' cannot be null.');
        }
        this.baseUri = 'https://management.azure.com';
        this.subscriptionId = subscriptionId;
        this.resourceGroups = new ResourceGroups(this);
        this.deployments = new Deployments(this);
    }

    public getRequestUri(uriFormat: string, parameters: {}, queryParameters?: string[]): string {
        var requestUri = this.baseUri + uriFormat;
        requestUri.replace('{subscriptionId}', encodeURIComponent(this.subscriptionId));
        for (var key in parameters) {
            requestUri.replace(key, encodeURIComponent(parameters[key]));
        }

        // trim all duplicate forward slashes in the url
        var regex = /([^:]\/)\/+/gi;
        requestUri = requestUri.replace(regex, '$1');

        // process query paramerters
        queryParameters = queryParameters || [];
        queryParameters.push('api-version=' + encodeURIComponent(this.apiVersion));
        requestUri += '?' + queryParameters.join('&');

        return requestUri
    }

    public beginRequest(request: azureServiceClient.WebRequest): Promise<azureServiceClient.WebResponse> {
        request.headers = request.headers || {};
        // Set default Headers
        if (this.generateClientRequestId) {
            request.headers['x-ms-client-request-id'] = msRestAzure.generateUuid();
        }
        if (this.acceptLanguage) {
            request.headers['accept-language'] = this.acceptLanguage;
        }
        request.headers['Content-Type'] = 'application/json; charset=utf-8';

        return super.beginRequest(request);
    }
}

export class ResourceGroups {
    private client: ResourceManagementClient;

    constructor(armClient: ResourceManagementClient) {
        this.client = armClient;
    }

    public checkExistence(resourceGroupName: string, callback) {
        if (!callback) {
            throw new Error('callback cannot be null.');
        }
        // Validate
        try {
            if (!resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
            if (resourceGroupName !== null && resourceGroupName !== undefined) {
                if (resourceGroupName.length > 90) {
                    throw new Error('"resourceGroupName" should satisfy the constraint - "MaxLength": 90');
                }
                if (resourceGroupName.length < 1) {
                    throw new Error('"resourceGroupName" should satisfy the constraint - "MinLength": 1');
                }
                if (resourceGroupName.match(/^[-\w\._\(\)]+$/) === null) {
                    throw new Error('"resourceGroupName" should satisfy the constraint - "Pattern": /^[-\w\._\(\)]+$/');
                }
            }
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
        return this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            if (response.statusCode == 204 || response.statusCode == 404) {
                callback(null, response.statusCode == 204);
            }
            else {
                return callback(azureServiceClient.ToError(response));
            }
        }).catch((error) => callback(error));
    }

    public deleteMethod(resourceGroupName, callback) {
        var client = this.client;
        if (!callback) {
            throw new Error('callback cannot be null.');
        }
        // Validate
        try {
            if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
            if (resourceGroupName !== null && resourceGroupName !== undefined) {
                if (resourceGroupName.length > 90) {
                    throw new Error('"resourceGroupName" should satisfy the constraint - "MaxLength": 90');
                }
                if (resourceGroupName.length < 1) {
                    throw new Error('"resourceGroupName" should satisfy the constraint - "MinLength": 1');
                }
                if (resourceGroupName.match(/^[-\w\._\(\)]+$/) === null) {
                    throw new Error('"resourceGroupName" should satisfy the constraint - "Pattern": /^[-\w\._\(\)]+$/');
                }
            }
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
            var statusCode = response.statusCode;
            if (statusCode !== 202 && statusCode !== 200) {
                return callback(azureServiceClient.ToError(response));
            }

            // Create Result
            this.client.getLongRunningOperationResult(response).then((response: azureServiceClient.WebResponse) => {
                if (response.statusCode == 200) {
                    return callback(null, response.body, httpRequest, response);
                }
                else {
                    return callback(azureServiceClient.ToError(response));
                }
            });
        }).catch((error) => callback(error));

    }
}

export class Deployments {
    private client: ResourceManagementClient;

    constructor(client: ResourceManagementClient) {
        this.client = client;
    }

    public createOrUpdate(resourceGroupName, deploymentName, parameters, callback) {
        var client = this.client;
        if (!callback) {
            throw new Error('callback cannot be null.');
        }
        // Validate
        try {
            if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
            if (resourceGroupName !== null && resourceGroupName !== undefined) {
                if (resourceGroupName.length > 90) {
                    throw new Error('"resourceGroupName" should satisfy the constraint - "MaxLength": 90');
                }
                if (resourceGroupName.length < 1) {
                    throw new Error('"resourceGroupName" should satisfy the constraint - "MinLength": 1');
                }
                if (resourceGroupName.match(/^[-\w\._\(\)]+$/) === null) {
                    throw new Error('"resourceGroupName" should satisfy the constraint - "Pattern": /^[-\w\._\(\)]+$/');
                }
            }
            if (deploymentName === null || deploymentName === undefined || typeof deploymentName.valueOf() !== 'string') {
                throw new Error('deploymentName cannot be null or undefined and it must be of type string.');
            }
            if (parameters === null || parameters === undefined) {
                throw new Error('parameters cannot be null or undefined.');
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
        var requestContent = null;
        try {
            if (parameters !== null && parameters !== undefined) {
                requestContent = JSON.stringify(parameters);
            }
        } catch (error) {
            var serializationError = new Error(util.format('Error "%s" occurred in serializing the ' +
                'payload - "%s"', error.message, util.inspect(parameters, { depth: null })));
            return callback(serializationError);
        }
        httpRequest.body = requestContent;

        // Send Request
        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            var statusCode = response.statusCode;
            if (statusCode !== 200 && statusCode !== 201) {
                callback(azureServiceClient.ToError(response));
            }

            this.client.getLongRunningOperationResult(response).then((operationResponse) => {
                return this.get(resourceGroupName, deploymentName, (error, response) => {
                    if (error) {
                        return callback(error);
                    } else {
                        if (response.body.properties.provisionState === "Succeeded") {
                            return callback(null, response);
                        } else {
                            return callback(response.body.properties.error);
                        }
                    }
                });
            });
        });
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
        return this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            if (response.statusCode != 200) {
                callback(azureServiceClient.ToError(response));
            }
            else {
                callback(null, response.body);
            }
        }).catch((error) => callback(error));

    }
}