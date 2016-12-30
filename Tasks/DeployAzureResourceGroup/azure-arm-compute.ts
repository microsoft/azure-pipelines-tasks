import msRestAzure = require("./ms-rest-azure");
import tl = require('vsts-task-lib/task');
import util = require("util");
import azureServiceClient = require("./AzureServiceClient");
import httpClient = require('vso-node-api/HttpClient');
import restClient = require('vso-node-api/RestClient');

export class ComputeManagementClient extends azureServiceClient.ServiceClient {
    private apiVersion;
    private acceptLanguage;
    private longRunningOperationRetryTimeout;
    private generateClientRequestId;
    private subscriptionId;
    private credentials: msRestAzure.ApplicationTokenCredentials;
    private baseUri;

    public virtualMachines;
    public virtualMachineExtensions;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId, baseUri?: any, options?: any) {
        super(credentials);
        this.acceptLanguage = 'en-US';
        this.longRunningOperationRetryTimeout = 30;
        this.generateClientRequestId = true;
        this.apiVersion = '2016-03-30';
        if (credentials === null || credentials === undefined) {
            throw new Error('\'credentials\' cannot be null');
        }
        if (subscriptionId === null || subscriptionId === undefined) {
            throw new Error('\'subscriptionId\' cannot be null');
        }
        if (!options)
            options = {};

        this.baseUri = baseUri;
        if (!this.baseUri) {
            this.baseUri = 'https://management.azure.com';
        }
        this.credentials = credentials;
        this.subscriptionId = subscriptionId;
        if (options.acceptLanguage != null && options.acceptLanguage != undefined) {
            this.acceptLanguage = options.acceptLanguage;
        }
        if (options.longRunningOperationRetryTimeout !== null && options.longRunningOperationRetryTimeout !== undefined) {
            this.longRunningOperationRetryTimeout = options.longRunningOperationRetryTimeout;
        }
        if (options.generateClientRequestId !== null && options.generateClientRequestId !== undefined) {
            this.generateClientRequestId = options.generateClientRequestId;
        }
        this.virtualMachines = new VirtualMachines(this);
        this.virtualMachineExtensions = new VirtualMachineExtensions(this);
    }

    public getRequestUri(uriFormat: string, parameters: {}, queryParameters?: string[]): string {
        var requestUri = this.baseUri + uriFormat;
        requestUri = requestUri.replace('{subscriptionId}', encodeURIComponent(this.subscriptionId));
        for (var key in parameters) {
            requestUri = requestUri.replace(key, encodeURIComponent(parameters[key]));
        }

        // trim all duplicate forward slashes in the url
        var regex = /([^:]\/)\/+/gi;
        requestUri = requestUri.replace(regex, '$1');

        // process query paramerters
        queryParameters = queryParameters || [];
        queryParameters.push('api-version=' + encodeURIComponent(this.apiVersion));
        if (queryParameters.length > 0) {
            requestUri += '?' + queryParameters.join('&');
        }
        return requestUri;
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

    public setHeaders(options): {} {
        var headers = {};
        if (options) {
            for (var headerName in options['customHeaders']) {
                if (options['customHeaders'].hasOwnProperty(headerName)) {
                    headers[headerName] = options['customHeaders'][headerName];
                }
            }
        }
        return headers;
    }
}

export class VirtualMachines {
    private client: ComputeManagementClient;

    constructor(client) {
        this.client = client;
    }

    public list(resourceGroupName, options, callback) {
        if (!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        if (!callback) {
            throw new Error('callback cannot be null.');
        }
        var apiVersion = '2016-03-30';
        // Validate
        try {
            if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
        }
        catch (error) {
            return callback(error);
        }

        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = this.client.setHeaders(options);
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines',
            {
                '{resourceGroupName}': resourceGroupName
            }
        );

        var result = [];
        this.client.beginRequest(httpRequest).then(async (response: azureServiceClient.WebResponse) => {
            if (response.statusCode == 200) {
                if (response.body.value) {
                    result.concat(response.body.value);
                }

                if (response.body.nextLink) {
                    var nextResult = await this.client.accumulateResultFromPagedResult(response.body.nextLink);
                    if (nextResult.error) { return nextResult; }
                    result.concat(nextResult.result);
                }
            }
            else {
                return new azureServiceClient.ApiResult(azureServiceClient.ToError(response));
            }
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public get(resourceGroupName, vmName, options, callback) {
        var client = this.client;
        if (!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        if (!callback) {
            throw new Error('callback cannot be null.');
        }
        var expand = (options && options.expand !== undefined) ? options.expand : undefined;
        var apiVersion = '2016-03-30';
        // Validate
        try {
            if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
            if (vmName === null || vmName === undefined || typeof vmName.valueOf() !== 'string') {
                throw new Error('vmName cannot be null or undefined and it must be of type string.');
            }
            if (expand) {
                var allowedValues = ['instanceView'];
                if (!allowedValues.some(function (item) { return item === expand; })) {
                    throw new Error(expand + ' is not a valid value. The valid values are: ' + allowedValues);
                }
            }
        } catch (error) {
            return callback(error);
        }

        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{vmName}': vmName
            },
            ['$expand=' + encodeURIComponent(expand)]
        );
        // Set Headers
        httpRequest.headers = this.client.setHeaders(options);

        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            if (response.statusCode == 200) {
                var result = response.body;
                return callback(null, result);
            }
            return callback(azureServiceClient.ToError(response));
        }).catch((error) => callback(error));
    }

    public restart(resourceGroupName: string, vmName: string, callback) {
        var client = this.client;
        if (!callback) {
            throw new Error('callback cannot be null.');
        }
        var apiVersion = '2016-03-30';
        // Validate
        try {
            if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
            if (vmName === null || vmName === undefined || typeof vmName.valueOf() !== 'string') {
                throw new Error('vmName cannot be null or undefined and it must be of type string.');
            }
        } catch (error) {
            return callback(error);
        }

        // Create object
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.headers = {};
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}/restart',
            {
                '{resourceGroupName}': resourceGroupName,
                '{vmName}': vmName
            }
        );
        // Set Headers
        httpRequest.headers = this.client.setHeaders(null);
        httpRequest.body = null;

        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            if (response.statusCode != 200 && response.statusCode != 201) {
                return callback(azureServiceClient.ToError(response));
            }
            this.client.getLongRunningOperationResult(response).then((operationResponse: azureServiceClient.WebResponse) => {
                if (operationResponse.body.status == "Succeeded") {
                    return callback(null, operationResponse.body);
                }
                return callback(azureServiceClient.ToError(operationResponse));
            }).catch((error) => callback(error));
        }).catch((error) => callback(error));
    }

    public start(resourceGroupName: string, vmName: string, callback) {
        var client = this.client;
        if (!callback) {
            throw new Error('callback cannot be null.');
        }
        var apiVersion = '2016-03-30';
        // Validate
        try {
            if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
            if (vmName === null || vmName === undefined || typeof vmName.valueOf() !== 'string') {
                throw new Error('vmName cannot be null or undefined and it must be of type string.');
            }
        } catch (error) {
            return callback(error);
        }

        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}/start',
            {
                '{resourceGroupName}': resourceGroupName,
                '{vmName}': vmName
            });
        httpRequest.headers = this.client.setHeaders(null);
        httpRequest.body = null;

        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            var statusCode = response.statusCode;
            if (statusCode != 200 && statusCode != 201) {
                return callback(azureServiceClient.ToError(response));
            }
            this.client.getLongRunningOperationResult(response).then((operationResponse: azureServiceClient.WebResponse) => {
                if (operationResponse.body.status == "Succeeded") {
                    return callback(null, operationResponse.body);
                }
                else {
                    return callback(azureServiceClient.ToError(operationResponse));
                }
            }).catch((error) => callback(error));
        }).catch((error) => callback(error));
    }

    public powerOff(resourceGroupName: string, vmName: string, callback) {
        var client = this.client;
        if (!callback) {
            throw new Error('callback cannot be null.');
        }
        var apiVersion = '2016-03-30';
        // Validate
        try {
            if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
            if (vmName === null || vmName === undefined || typeof vmName.valueOf() !== 'string') {
                throw new Error('vmName cannot be null or undefined and it must be of type string.');
            }
        } catch (error) {
            return callback(error);
        }

        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.headers = this.client.setHeaders(null);
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}/powerOff',
            {
                '{resourceGroupName}': resourceGroupName,
                '{vmName}': vmName
            }
        );
        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            var statusCode = response.statusCode;
            if (statusCode != 200 && statusCode != 201) {
                return callback(azureServiceClient.ToError(response));
            }
            this.client.getLongRunningOperationResult(response).then((operationResponse: azureServiceClient.WebResponse) => {
                if (operationResponse.body.status == "Succeeded") {
                    return callback(null, operationResponse.body);
                }
                else {
                    return callback(azureServiceClient.ToError(operationResponse));
                }
            });
        }).catch((error) => callback(error));
    }

    public deleteMethod(resourceGroupName: string, vmName: string, callback) {
        var client = this.client;
        if (!callback) {
            throw new Error('callback cannot be null.');
        }
        var apiVersion = '2016-03-30';
        // Validate
        try {
            if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
            if (vmName === null || vmName === undefined || typeof vmName.valueOf() !== 'string') {
                throw new Error('vmName cannot be null or undefined and it must be of type string.');
            }
        } catch (error) {
            return callback(error);
        }

        // Create object
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'DELETE';
        httpRequest.headers = this.client.setHeaders(null);
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{vmName}': vmName
            }
        );
        httpRequest.body = null;
        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            var statusCode = response.statusCode;
            if (statusCode != 200 && statusCode != 201) {
                callback(azureServiceClient.ToError(response));
            }
            this.client.getLongRunningOperationResult(response).then((operationResponse: azureServiceClient.WebResponse) => {
                if (operationResponse.body.status === "Succeeded") {
                    // Generate Response
                    callback(null, operationResponse.body);
                } else {
                    return callback(azureServiceClient.ToError(operationResponse));
                }
            });
        });
    }
}

export class VirtualMachineExtensions {
    private client: ComputeManagementClient;

    constructor(client) {
        this.client = client;
    }

    public get(resourceGroupName, vmName, vmExtensionName, options, callback) {
        var client = this.client;
        if (!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        if (!callback) {
            throw new Error('callback cannot be null.');
        }
        var expand = (options && options.expand !== undefined) ? options.expand : undefined;
        var apiVersion = '2016-03-30';
        // Validate
        try {
            if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
            if (vmName === null || vmName === undefined || typeof vmName.valueOf() !== 'string') {
                throw new Error('vmName cannot be null or undefined and it must be of type string.');
            }
            if (vmExtensionName === null || vmExtensionName === undefined || typeof vmExtensionName.valueOf() !== 'string') {
                throw new Error('vmExtensionName cannot be null or undefined and it must be of type string.');
            }
            if (expand !== null && expand !== undefined && typeof expand.valueOf() !== 'string') {
                throw new Error('expand must be of type string.');
            }
        } catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = this.client.setHeaders(options);
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}/extensions/{vmExtensionName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{vmName}': vmName,
                '{vmExtensionName}': vmExtensionName
            }
        );
        httpRequest.body = null;

        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            if (response.statusCode == 200) {
                var result = response.body;
                return callback(null, result);
            }
            return callback(azureServiceClient.ToError(response));
        }).catch((error) => callback(error));
    }

    public createOrUpdate(resourceGroupName, vmName, vmExtensionName, extensionParameters, callback) {
        var client = this.client;

        if (!callback) {
            throw new Error('callback cannot be null.');
        }
        var apiVersion = '2016-03-30';
        // Validate
        try {
            if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
            if (vmName === null || vmName === undefined || typeof vmName.valueOf() !== 'string') {
                throw new Error('vmName cannot be null or undefined and it must be of type string.');
            }
            if (vmExtensionName === null || vmExtensionName === undefined || typeof vmExtensionName.valueOf() !== 'string') {
                throw new Error('vmExtensionName cannot be null or undefined and it must be of type string.');
            }
            if (extensionParameters === null || extensionParameters === undefined) {
                throw new Error('extensionParameters cannot be null or undefined.');
            }
        } catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.headers = this.client.setHeaders(null);
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}/extensions/{vmExtensionName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{vmName}': vmName,
                '{vmExtensionName}': vmExtensionName
            }
        );

        // Serialize Request
        var requestContent = null;
        var requestModel = null;
        try {
            if (extensionParameters !== null && extensionParameters !== undefined) {
                requestContent = JSON.stringify(extensionParameters);
            }
        } catch (error) {
            var serializationError = new Error(util.format('Error "%s" occurred in serializing the ' +
                'payload - "%s"', error.message, util.inspect(extensionParameters, { depth: null })));
            return callback(serializationError);
        }
        httpRequest.body = requestContent;

        // Send request
        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            if (response.statusCode != 200 && response.statusCode != 201) {
                return callback(azureServiceClient.ToError(response));
            }
            this.client.getLongRunningOperationResult(response).then((operationResponse: azureServiceClient.WebResponse) => {
                if (operationResponse.body.status === "Succeeded") {
                    var result = { "provisioningState": operationResponse.body.status }
                    callback(null, result);
                } else {
                    callback(azureServiceClient.ToError(operationResponse));
                }
            }).catch((error) => callback(error));
        }).catch((error) => callback(error));

    }

    public delete(resourceGroupName, vmName, vmExtensionName, callback) {
        if (!callback) {
            throw new Error('callback cannot be null.');
        }

        var apiVersion = '2016-03-30';
        // Validate
        try {
            if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
            if (vmName === null || vmName === undefined || typeof vmName.valueOf() !== 'string') {
                throw new Error('vmName cannot be null or undefined and it must be of type string.');
            }
            if (vmExtensionName === null || vmExtensionName === undefined || typeof vmExtensionName.valueOf() !== 'string') {
                throw new Error('vmExtensionName cannot be null or undefined and it must be of type string.');
            }
        } catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'DELETE';
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}/extensions/{vmExtensionName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{vmName}': vmName,
                '{vmExtensionName}': vmExtensionName
            }
        );

        // Send request
        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            if (response.statusCode !== 202 || response.statusCode !== 204) {
                callback(azureServiceClient.ToError(response));
            }
            this.client.getLongRunningOperationResult(response).then((operationResponse: azureServiceClient.WebResponse) => {
                if (operationResponse.statusCode === 200) {
                    callback(null);
                } else {
                    callback(azureServiceClient.ToError(operationResponse));
                }
            }).catch((error) => callback(error));
        }).catch((error) => callback(error));
    }
}