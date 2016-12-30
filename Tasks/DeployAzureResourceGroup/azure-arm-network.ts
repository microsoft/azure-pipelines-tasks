import msRestAzure = require("./ms-rest-azure");
import tl = require('vsts-task-lib/task');
import util = require("util");
import azureServiceClient = require("./AzureServiceClient");
import Q = require("q");

export class NetworkManagementClient extends azureServiceClient.ServiceClient {
    private apiVersion;
    private acceptLanguage;
    public longRunningOperationRetryTimeout;
    private generateClientRequestId;
    private subscriptionId;
    private baseUri;

    public networkSecurityGroups;
    public networkInterfaces;
    public publicIPAddresses;
    public loadBalancers;
    public securityRules;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId, baseUri?: any, options?: any) {
        super(credentials);
        this.apiVersion = '2016-09-01';
        this.acceptLanguage = 'en-US';
        this.longRunningOperationRetryTimeout = 30;
        this.generateClientRequestId = true;

        if (credentials === null || credentials === undefined) {
            throw new Error('\'credentials\' cannot be null.');
        }
        if (subscriptionId === null || subscriptionId === undefined) {
            throw new Error('\'subscriptionId\' cannot be null.');
        }

        if (!options) options = {};

        this.baseUri = baseUri;
        if (!this.baseUri) {
            this.baseUri = 'https://management.azure.com';
        }
        this.subscriptionId = subscriptionId;

        if (options.apiVersion !== null && options.apiVersion !== undefined) {
            this.apiVersion = options.apiVersion;
        }
        if (options.acceptLanguage !== null && options.acceptLanguage !== undefined) {
            this.acceptLanguage = options.acceptLanguage;
        }
        if (options.longRunningOperationRetryTimeout !== null && options.longRunningOperationRetryTimeout !== undefined) {
            this.longRunningOperationRetryTimeout = options.longRunningOperationRetryTimeout;
        }
        if (options.generateClientRequestId !== null && options.generateClientRequestId !== undefined) {
            this.generateClientRequestId = options.generateClientRequestId;
        }

        this.loadBalancers = new loadBalancers(this);
        this.publicIPAddresses = new publicIPAddresses(this);
        this.networkSecurityGroups = new networkSecurityGroups(this);
        this.networkInterfaces = new NetworkInterfaces(this);
        this.securityRules = new securityRules(this);
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

    public setCustomHeaders(options): {} {
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

export class loadBalancers {
    private client: NetworkManagementClient;

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
        // Validate
        try {
            if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
        } catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = {};
        httpRequest.uri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Network/loadBalancers',
            {
                '{resourceGroupName}': resourceGroupName
            }
        );
        // Set Headers
        httpRequest.headers = this.client.setCustomHeaders(options);
        httpRequest.body = null;

        //send request
        var result = [];
        this.client.beginRequest(httpRequest).then(async (response: azureServiceClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            if (response.statusCode == 200) {
                if (response.body.value) {
                    result = result.concat(response.body.value);
                }

                if (response.body.nextLink) {
                    var nextResult = await this.client.accumulateResultFromPagedResult(response.body.nextLink);
                    if (nextResult.error) {
                        deferred.reject(new azureServiceClient.ApiResult(nextResult.error));
                    }
                    result.concat(nextResult.result);
                }

                deferred.resolve(new azureServiceClient.ApiResult(null, result));
            }
            else {
                deferred.reject(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public get(resourceGroupName, loadBalancerName, options, callback) {
        var client = this.client;
        if (!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        if (!callback) {
            throw new Error('callback cannot be null.');
        }
        var expand = (options && options.expand !== undefined) ? options.expand : undefined;
        // Validate
        try {
            if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
            if (loadBalancerName === null || loadBalancerName === undefined || typeof loadBalancerName.valueOf() !== 'string') {
                throw new Error('loadBalancerName cannot be null or undefined and it must be of type string.');
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
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Network/loadBalancers/{loadBalancerName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{loadBalancerName}': loadBalancerName
            });
        httpRequest.headers = this.client.setCustomHeaders(options);
        httpRequest.body = null;

        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            if (response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.reject(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public createOrUpdate(resourceGroupName, loadBalancerName, parameters, options, callback) {
        var client = this.client;
        if (!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        if (!callback) {
            throw new Error('callback cannot be null.');
        }
        // Validate
        try {
            if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
            if (loadBalancerName === null || loadBalancerName === undefined || typeof loadBalancerName.valueOf() !== 'string') {
                throw new Error('loadBalancerName cannot be null or undefined and it must be of type string.');
            }
            if (parameters === null || parameters === undefined) {
                throw new Error('parameters cannot be null or undefined.');
            }
        }
        catch (error) {
            return callback(error);
        }

        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.headers = {};
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Network/loadBalancers/{loadBalancerName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{loadBalancerName}': loadBalancerName
            });
        // Set Headers
        httpRequest.headers = this.client.setCustomHeaders(options);

        if (parameters !== null && parameters !== undefined) {
            httpRequest.body = JSON.stringify(parameters);
        }

        this.client.beginRequest(httpRequest).then((response) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            var statusCode = response.statusCode;
            if (statusCode != 200 && statusCode != 201) {
                deferred.reject(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }

            this.client.getLongRunningOperationResult(response).then((operationResponse: azureServiceClient.WebResponse) => {
                if (operationResponse.body.status === "Succeeded") {
                    // Generate Response
                    deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
                }
                else {
                    // Generate Error
                    deferred.reject(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
                }
            })
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }
}

export class publicIPAddresses {
    private client: NetworkManagementClient;
    constructor(client) {
        this.client = client;
    }

    public list(resourceGroupName, options, callback) {
        var client = this.client;
        if (!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        if (!callback) {
            throw new Error('callback cannot be null.');
        }
        // Validate
        try {
            if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
        } catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Network/publicIPAddresses',
            {
                '{resourceGroupName}': resourceGroupName
            });
        // Set Headers
        httpRequest.headers = this.client.setCustomHeaders(options);
        httpRequest.body = null;

        var result = [];
        this.client.beginRequest(httpRequest).then(async (response: azureServiceClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            if (response.statusCode == 200) {
                if (response.body.value) {
                    result = result.concat(response.body.value);
                }
                if (response.body.nextLink) {
                    var nextResult = await this.client.accumulateResultFromPagedResult(response.body.nextLink);
                    if (nextResult.error) {
                        deferred.reject(new azureServiceClient.ApiResult(nextResult.error));
                    }
                    result = result.concat(nextResult);
                }
                deferred.resolve(new azureServiceClient.ApiResult(null, result));
            }
            else {
                deferred.reject(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }
}

export class networkSecurityGroups {
    private client: NetworkManagementClient;
    constructor(client) {
        this.client = client;
    }

    public list(resourceGroupName, options, callback) {
        var client = this.client;
        if (!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        if (!callback) {
            throw new Error('callback cannot be null.');
        }
        // Validate
        try {
            if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
        } catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Network/networkSecurityGroups',
            {
                '{resourceGroupName}': resourceGroupName
            }
        );

        // Set Headers
        httpRequest.headers = this.client.setCustomHeaders(options);
        httpRequest.body = null;

        var result = [];
        this.client.beginRequest(httpRequest).then(async (response: azureServiceClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            if (response.statusCode == 200) {
                if (response.body.value) {
                    result = result.concat(response.body.value);
                }
                if (response.body.nextLink) {
                    var nextResult = await this.client.accumulateResultFromPagedResult(response.body.nextLink);
                    if (nextResult.error) {
                        deferred.reject(new azureServiceClient.ApiResult(nextResult.error));
                    }
                    result = result.concat(nextResult);
                }
                deferred.resolve(new azureServiceClient.ApiResult(null, result));
            }
            else {
                deferred.reject(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }
}

export class NetworkInterfaces {
    private client: NetworkManagementClient;
    constructor(client) {
        this.client = client;
    }

    public list(resourceGroupName, options, callback) {
        var client = this.client;
        if (!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        if (!callback) {
            throw new Error('callback cannot be null.');
        }
        // Validate
        try {
            if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
        } catch (error) {
            return callback(error);
        }

        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Network/networkInterfaces',
            {
                '{resourceGroupName}': resourceGroupName
            }
        );
        httpRequest.headers = this.client.setCustomHeaders(options);
        httpRequest.body = null;

        var result = [];
        this.client.beginRequest(httpRequest).then(async (response: azureServiceClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            if (response.statusCode == 200) {
                if (response.body.value) {
                    result = result.concat(response.body.value);
                }
                if (response.body.nextLink) {
                    var nextResult = await this.client.accumulateResultFromPagedResult(response.body.nextLink);
                    if (nextResult.error) {
                        deferred.reject(new azureServiceClient.ApiResult(nextResult.error));
                    }
                    result = result.concat(nextResult);
                }
                deferred.resolve(new azureServiceClient.ApiResult(null, result));
            }
            else {
                deferred.reject(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public createOrUpdate(resourceGroupName, networkInterfaceName, parameters, options, callback) {
        var client = this.client;
        if (!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        if (!callback) {
            throw new Error('callback cannot be null.');
        }
        // Validate
        try {
            if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
            if (networkInterfaceName === null || networkInterfaceName === undefined || typeof networkInterfaceName.valueOf() !== 'string') {
                throw new Error('networkInterfaceName cannot be null or undefined and it must be of type string.');
            }
            if (parameters === null || parameters === undefined) {
                throw new Error('parameters cannot be null or undefined.');
            }
        }
        catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Network/networkInterfaces/{networkInterfaceName}',
            {
                '{networkInterfaceName}': networkInterfaceName,
                '{resourceGroupName}': resourceGroupName
            }
        );
        httpRequest.headers = this.client.setCustomHeaders(options);
        if (parameters) {
            httpRequest.body = JSON.stringify(parameters);
        }

        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            if (response.statusCode != 200 && response.statusCode != 201) {
                deferred.reject(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }

            this.client.getLongRunningOperationResult(response).then((operationResponse) => {
                if (operationResponse.body.status === "Succeeded") {
                    deferred.resolve(new azureServiceClient.ApiResult(null, operationResponse.body.value));
                }
                else {
                    deferred.reject(new azureServiceClient.ApiResult(azureServiceClient.ToError(operationResponse)));
                }
            });
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }
}

export class securityRules {
    private client: NetworkManagementClient;
    constructor(client) {
        this.client = client;
    }

    public get(resourceGroupName, networkSecurityGroupName, securityRuleName, options, callback) {
        var client = this.client;
        if (!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        if (!callback) {
            throw new Error('callback cannot be null.');
        }
        // Validate
        try {
            if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
            if (networkSecurityGroupName === null || networkSecurityGroupName === undefined || typeof networkSecurityGroupName.valueOf() !== 'string') {
                throw new Error('networkSecurityGroupName cannot be null or undefined and it must be of type string.');
            }
            if (securityRuleName === null || securityRuleName === undefined || typeof securityRuleName.valueOf() !== 'string') {
                throw new Error('securityRuleName cannot be null or undefined and it must be of type string.');
            }
        } catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Network/networkSecurityGroups/{networkSecurityGroupName}/securityRules/{securityRuleName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{networkSecurityGroupName}': networkSecurityGroupName,
                '{securityRuleName}': securityRuleName
            }
        );
        httpRequest.headers = this.client.setCustomHeaders(options);
        httpRequest.body = null;
        // Send Request
        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            if (response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.reject(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public createOrUpdate(resourceGroupName, networkSecurityGroupName, securityRuleName, securityRuleParameters, callback) {
        var client = this.client;
        if (!callback) {
            throw new Error('callback cannot be null.');
        }
        // Validate
        try {
            if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
            if (networkSecurityGroupName === null || networkSecurityGroupName === undefined || typeof networkSecurityGroupName.valueOf() !== 'string') {
                throw new Error('networkSecurityGroupName cannot be null or undefined and it must be of type string.');
            }
            if (securityRuleName === null || securityRuleName === undefined || typeof securityRuleName.valueOf() !== 'string') {
                throw new Error('securityRuleName cannot be null or undefined and it must be of type string.');
            }
            if (securityRuleParameters === null || securityRuleParameters === undefined) {
                throw new Error('securityRuleParameters cannot be null or undefined.');
            }
        } catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Network/networkSecurityGroups/{networkSecurityGroupName}/securityRules/{securityRuleName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{networkSecurityGroupName}': networkSecurityGroupName,
                '{securityRuleName}': securityRuleName
            }
        );

        httpRequest.headers = this.client.setCustomHeaders(null);
        if (securityRuleParameters) {
            httpRequest.body = JSON.stringify(securityRuleParameters);
        }

        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            var statusCode = response.statusCode;
            if (statusCode != 200 && statusCode != 201) {
                deferred.reject(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            else {
                this.client.getLongRunningOperationResult(response).then((operationResponse) => {
                    if (operationResponse.body.status === "Succeeded") {
                        deferred.resolve(new azureServiceClient.ApiResult(null, operationResponse.body));
                    }
                    else{
                        deferred.reject(new azureServiceClient.ApiResult(azureServiceClient.ToError(operationResponse)));
                    }
                });
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }
}