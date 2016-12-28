import msRestAzure = require("./ms-rest-azure");
import tl = require('vsts-task-lib/task');
import util = require("util");
import azureServiceClient = require("./AzureServiceClient");

export class NetworkManagementClient extends azureServiceClient.ServiceClient {
    private apiVersion;
    private acceptLanguage;
    public longRunningOperationRetryTimeout;
    private generateClientRequestId;
    private subscriptionId;
    public credentials;
    public baseUri;
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
        this.models = {};

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
        this.credentials = credentials;
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

    public setHeaders(options): {} {
        var headers = {};
        if (this.generateClientRequestId) {
            headers['x-ms-client-request-id'] = msRestAzure.generateUuid();
        }
        if (this.acceptLanguage !== undefined && this.acceptLanguage !== null) {
            headers['accept-language'] = this.acceptLanguage;
        }
        if (options) {
            for (var headerName in options['customHeaders']) {
                if (options['customHeaders'].hasOwnProperty(headerName)) {
                    headers[headerName] = options['customHeaders'][headerName];
                }
            }
        }
        headers['Content-Type'] = 'application/json; charset=utf-8';
        return headers;
    }

    public validate() {
        if (this.apiVersion === null || this.apiVersion === undefined || typeof this.apiVersion.valueOf() !== 'string') {
            throw new Error('this.client.apiVersion cannot be null or undefined and it must be of type string.');
        }
        if (this.subscriptionId === null || this.subscriptionId === undefined || typeof this.subscriptionId.valueOf() !== 'string') {
            throw new Error('this.client.subscriptionId cannot be null or undefined and it must be of type string.');
        }
        if (this.acceptLanguage !== null && this.acceptLanguage !== undefined && typeof this.acceptLanguage.valueOf() !== 'string') {
            throw new Error('this.client.acceptLanguage must be of type string.');
        }
    }
}

export class loadBalancers {
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
            this.client.validate();
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
        httpRequest.headers = this.client.setHeaders(options);
        httpRequest.body = null;

        //send request
        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            if (response.statusCode == 200) {
                return callback(null, response.body);
            }
            return callback(azureServiceClient.ToError(response));
        }).catch((error) => callback(error));
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
            this.client.validate();
        } catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = {
            authorization: 'Bearer ' + this.client.credentials
        };
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Network/loadBalancers/{loadBalancerName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{loadBalancerName}': loadBalancerName
            });
        httpRequest.headers = this.client.setHeaders(options);
        httpRequest.body = null;

        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            if (response.statusCode == 200) {
                return callback(null, response.body);
            }
            return callback(azureServiceClient.ToError(response));

        }).catch((error) => callback(error));
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
            this.client.validate();
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
        httpRequest.headers = this.client.setHeaders(options);

        /// Serialize Request
        var requestContent = null;
        var requestModel = null;

        if (parameters !== null && parameters !== undefined) {
            requestContent = JSON.stringify(parameters);
        }

        httpRequest.body = requestContent;
        this.client.beginRequest(httpRequest).then((response) => {
            var statusCode = response.statusCode;
            if (statusCode != 200 && statusCode != 201) {
                callback(azureServiceClient.ToError(response));
            }

            this.client.getLongRunningOperationResult(response).then((operationResponse: azureServiceClient.WebResponse) => {
                if (operationResponse.body.status === "Succeeded") {
                    // Generate Response
                    return callback(null, response.body);
                }
                else {
                    // Generate Error
                    return callback(azureServiceClient.ToError(response));
                }
            });
        }).catch((error) => callback(error));
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
            this.client.validate();
        } catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = {
            authorization: 'Bearer ' + client.credentials
        };
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Network/publicIPAddresses',
            {
                '{resourceGroupName}': resourceGroupName
            });
        // Set Headers
        httpRequest.headers = this.client.setHeaders(options);
        httpRequest.body = null;

        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            if (response.statusCode == 200) {
                var result = JSON.parse(response.body);
                return callback(null, result);
            }
            return callback(azureServiceClient.ToError(response));
        }).catch((error) => callback(error));
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
            this.client.validate();
        } catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = {
            authorization: 'Bearer ' + this.client.credentials
        };
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Network/networkSecurityGroups',
            {
                '{resourceGroupName}': resourceGroupName
            }
        );

        // Set Headers
        httpRequest.headers = this.client.setHeaders(options);
        httpRequest.body = null;

        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            if (response.statusCode == 200) {
                var result = JSON.parse(response.body);
                return callback(null, result);
            }
            callback(azureServiceClient.ToError(response));
        }).catch((error) => callback(error));
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
            this.client.validate();
        } catch (error) {
            return callback(error);
        }

        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = {
            authorization: 'Bearer ' + this.client.credentials
        };
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Network/networkInterfaces',
            {
                '{resourceGroupName}': resourceGroupName
            }
        );
        httpRequest.headers = this.client.setHeaders(options);
        httpRequest.body = null;

        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            if (response.statusCode == 200) {
                var result = JSON.parse(response.body);
                return callback(null, result);
            }
            return callback(azureServiceClient.ToError(response));
        }).catch((error) => callback(error));
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
            this.client.validate();
        }
        catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.headers = {};
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Network/networkInterfaces/{networkInterfaceName}',
            {
                '{networkInterfaceName}': networkInterfaceName,
                '{resourceGroupName}': resourceGroupName
            }
        );
        httpRequest.headers = this.client.setHeaders(options);

        var requestContent = null;
        var requestModel = null;
        try {
            if (parameters !== null && parameters !== undefined) {
                requestContent = JSON.stringify(parameters);
            }
        }
        catch (error) {
            var serializationError = new Error(util.format('Error "%s" occurred in serializing the ' +
                'payload - "%s"', error.message, util.inspect(parameters, { depth: null })));
            return callback(serializationError);
        }
        httpRequest.body = requestContent;

        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            if (response.statusCode != 200 && response.statusCode != 201) {
                callback(azureServiceClient.ToError(response));
            }
            this.client.getLongRunningOperationResult(response).then((operationResponse) => {
                if (operationResponse.body.status === "Succeeded") {
                    return callback(null, operationResponse.body);
                }
                return callback(azureServiceClient.ToError(response));
            }).catch((error) => callback(error));
        }).catch((error) => callback(error));
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
            this.client.validate();
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
        httpRequest.headers = this.client.setHeaders(options);
        httpRequest.body = null;
        // Send Request
        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            if (response.statusCode == 200) {
                var result = JSON.parse(response.body);
                return callback(null, result);
            }
            return callback(azureServiceClient.ToError(response));
        }).catch((error) => callback(error));
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
            this.client.validate();
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

        httpRequest.headers = this.client.setHeaders(null);
        // Serialize Request
        var requestContent = null;
        var requestModel = null;
        try {
            if (securityRuleParameters !== null && securityRuleParameters !== undefined) {
                requestContent = JSON.stringify(securityRuleParameters);
            }
        } catch (error) {
            // Todo: error for json parsing the parameters
            var stringificationError = new Error(util.format('Error "%s" occurred in reading the ' +
                'parameters - "%s"', error.message, util.inspect(securityRuleParameters, { depth: null })));
            return callback(stringificationError);
        }
        httpRequest.body = requestContent;

        this.client.beginRequest(httpRequest).then((response: azureServiceClient.WebResponse) => {
            var statusCode = response.statusCode;
            if (statusCode != 200 && statusCode != 201) {
                return callback(azureServiceClient.ToError(response));
            }
            this.client.getLongRunningOperationResult(response).then((operationResponse) => {
                if (operationResponse.body.status === "Succeeded") {
                    callback(null, JSON.parse(response.body));
                }
                callback(azureServiceClient.ToError(operationResponse));
            }).catch((error) => callback(error));
        }).catch((error) => callback(error));
    }
}