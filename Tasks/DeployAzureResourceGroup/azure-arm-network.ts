import msRestAzure = require("./ms-rest-azure");
import tl = require('vsts-task-lib/task');
import util = require("util");
import azureServiceClient = require("./AzureServiceClient");
import httpClient = require('vso-node-api/HttpClient');
import restClient = require('vso-node-api/RestClient');

export class NetworkManagementClient {
    public apiVersion;
    public acceptLanguage;
    private longRunningOperationRetryTimeout;
    private generateClientRequestId;
    private subscriptionId;
    private credentials;
    private baseUri;
    public models;
    private httpObj;
    private restObj;
    public networkSecurityGroups;
    public networkInterfaces;
    public publicIPAddresses;
    public loadBalancers;
    public securityRules;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId, baseUri, options) {
        this.apiVersion = '2016-09-01';
        this.acceptLanguage = 'en-US';
        this.longRunningOperationRetryTimeout = 30;
        this.generateClientRequestId = true;
        // this.httpObj = new httpClient.HttpCallbackClient(tl.getVariable("AZURE_HTTP_USER_AGENT"));
        // this.restObj = new restClient.RestCallbackClient(this.httpObj);

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

        if(options.apiVersion !== null && options.apiVersion !== undefined) { 
            this.apiVersion = options.apiVersion;
        }
        if(options.acceptLanguage !== null && options.acceptLanguage !== undefined) { 
            this.acceptLanguage = options.acceptLanguage;
        }
        if(options.longRunningOperationRetryTimeout !== null && options.longRunningOperationRetryTimeout !== undefined) { 
            this.longRunningOperationRetryTimeout = options.longRunningOperationRetryTimeout;
        }
        if(options.generateClientRequestId !== null && options.generateClientRequestId !== undefined) { 
            this.generateClientRequestId = options.generateClientRequestId;
        }

        this.loadBalancers = new loadBalancers(this);
        this.publicIPAddresses = new publicIPAddresses(this);
        this.networkSecurityGroups = new networkSecurityGroups(this);
        this.networkInterfaces = new NetworkInterfaces(this);
        this.securityRules = new securityRules(this);
        this.models['CloudError'] = new msRestAzure.CloudError();
        this.models['LoadBalancerListResult'] = new LoadBalancerListResultModel();
        this.models['PublicIPAddressListResult'] = new PublicIPAddressListResultModel();
        this.models['NetworkSecurityGroupListResult'] = new NetworkSecurityGroupListResultModel();
        this.models['NetworkInterfaceListResult'] = new NetworkInterfaceListResultModel();
        this.models['SecurityRule'] = new SecurityRuleModel();
        this.models['LoadBalancer'] = new LoadBalancerModel();
    }
}

export class SecurityRuleModel{
    constructor(){}

    public mapper(){
        return {
            required: false,
            serializedName: 'SecurityRule',
            type: {
                name: 'Composite',
                className: 'SecurityRule',
                modelProperties: {
                    id: {
                        required: false,
                        serializedName: 'id',
                        type: {
                            name: 'String'
                        }
                    },
                    description: {
                        required: false,
                        serializedName: 'properties.description',
                        type: {
                            name: 'String'
                        }
                    },
                    protocol: {
                        required: true,
                        serializedName: 'properties.protocol',
                        type: {
                            name: 'String'
                        }
                    },
                    sourcePortRange: {
                        required: false,
                        serializedName: 'properties.sourcePortRange',
                        type: {
                            name: 'String'
                        }
                    },
                    destinationPortRange: {
                        required: false,
                        serializedName: 'properties.destinationPortRange',
                        type: {
                            name: 'String'
                        }
                    },
                    sourceAddressPrefix: {
                        required: true,
                        serializedName: 'properties.sourceAddressPrefix',
                        type: {
                            name: 'String'
                        }
                    },
                    destinationAddressPrefix: {
                        required: true,
                        serializedName: 'properties.destinationAddressPrefix',
                        type: {
                            name: 'String'
                        }
                    },
                    access: {
                        required: true,
                        serializedName: 'properties.access',
                        type: {
                            name: 'String'
                        }
                    },
                    priority: {
                        required: false,
                        serializedName: 'properties.priority',
                        type: {
                            name: 'Number'
                        }
                    },
                    direction: {
                        required: true,
                        serializedName: 'properties.direction',
                        type: {
                            name: 'String'
                        }
                    },
                    provisioningState: {
                        required: false,
                        serializedName: 'properties.provisioningState',
                        type: {
                            name: 'String'
                        }
                    },
                    name: {
                        required: false,
                        serializedName: 'name',
                        type: {
                            name: 'String'
                        }
                    },
                    etag: {
                        required: false,
                        serializedName: 'etag',
                        type: {
                            name: 'String'
                        }
                    }
                }
            }
        };
    }
}

export class NetworkInterfaceListResultModel{
    constructor(){}

    public mapper(){
        return {
            required: false,
            serializedName: 'NetworkInterfaceListResult',
            type: {
            name: 'Composite',
            className: 'NetworkInterfaceListResult',
            modelProperties: {
                value: {
                    required: false,
                    serializedName: '',
                    type: {
                        name: 'Sequence',
                        element: {
                            required: false,
                            serializedName: 'NetworkInterfaceElementType',
                            type: {
                            name: 'Composite',
                            className: 'NetworkInterface'
                            }
                        }
                    }
                },
                nextLink: {
                    required: false,
                    serializedName: 'nextLink',
                    type: {
                        name: 'String'
                    }
                }
            }
            }
        };
    }
}

export class NetworkSecurityGroupListResultModel{
    constructor(){}

    public mapper(){
        return {
            required: false,
            serializedName: 'NetworkSecurityGroupListResult',
            type: {
                name: 'Composite',
                className: 'NetworkSecurityGroupListResult',
                modelProperties: {
                    value: {
                        required: false,
                        serializedName: '',
                        type: {
                            name: 'Sequence',
                            element: {
                                required: false,
                                serializedName: 'NetworkSecurityGroupElementType',
                                type: {
                                    name: 'Composite',
                                    className: 'NetworkSecurityGroup'
                                }
                            }
                        }
                    },
                    nextLink: {
                        required: false,
                        serializedName: 'nextLink',
                        type: {
                            name: 'String'
                        }
                    }
                }
            }
        };
    }
}

export class LoadBalancerListResultModel{
    constructor(){}

    public mapper(){
        return {
            required: false,
            serializedName: 'LoadBalancerListResult',
            type: {
            name: 'Composite',
            className: 'LoadBalancerListResult',
            modelProperties: {
                value: {
                required: false,
                serializedName: '',
                type: {
                    name: 'Sequence',
                    element: {
                        required: false,
                        serializedName: 'LoadBalancerElementType',
                        type: {
                        name: 'Composite',
                        className: 'LoadBalancer'
                        }
                    }
                }
                },
                nextLink: {
                required: false,
                serializedName: 'nextLink',
                type: {
                    name: 'String'
                }
                }
            }
            }
        };
    }
}

export class LoadBalancerModel{
    constructor(){
    }

    public mapper(){
        return {
            required: false,
            serializedName: 'LoadBalancer',
            type: {
            name: 'Composite',
            className: 'LoadBalancer',
            modelProperties: {
                id: {
                required: false,
                serializedName: 'id',
                type: {
                    name: 'String'
                }
                },
                name: {
                required: false,
                readOnly: true,
                serializedName: 'name',
                type: {
                    name: 'String'
                }
                },
                type: {
                required: false,
                readOnly: true,
                serializedName: 'type',
                type: {
                    name: 'String'
                }
                },
                location: {
                required: false,
                serializedName: 'location',
                type: {
                    name: 'String'
                }
                },
                tags: {
                required: false,
                serializedName: 'tags',
                type: {
                    name: 'Dictionary',
                    value: {
                        required: false,
                        serializedName: 'StringElementType',
                        type: {
                        name: 'String'
                        }
                    }
                }
                },
                frontendIPConfigurations: {
                required: false,
                serializedName: 'properties.frontendIPConfigurations',
                type: {
                    name: 'Sequence',
                    element: {
                        required: false,
                        serializedName: 'FrontendIPConfigurationElementType',
                        type: {
                        name: 'Composite',
                        className: 'FrontendIPConfiguration'
                        }
                    }
                }
                },
                backendAddressPools: {
                required: false,
                serializedName: 'properties.backendAddressPools',
                type: {
                    name: 'Sequence',
                    element: {
                        required: false,
                        serializedName: 'BackendAddressPoolElementType',
                        type: {
                        name: 'Composite',
                        className: 'BackendAddressPool'
                        }
                    }
                }
                },
                loadBalancingRules: {
                required: false,
                serializedName: 'properties.loadBalancingRules',
                type: {
                    name: 'Sequence',
                    element: {
                        required: false,
                        serializedName: 'LoadBalancingRuleElementType',
                        type: {
                        name: 'Composite',
                        className: 'LoadBalancingRule'
                        }
                    }
                }
                },
                probes: {
                required: false,
                serializedName: 'properties.probes',
                type: {
                    name: 'Sequence',
                    element: {
                        required: false,
                        serializedName: 'ProbeElementType',
                        type: {
                        name: 'Composite',
                        className: 'Probe'
                        }
                    }
                }
                },
                inboundNatRules: {
                required: false,
                serializedName: 'properties.inboundNatRules',
                type: {
                    name: 'Sequence',
                    element: {
                        required: false,
                        serializedName: 'InboundNatRuleElementType',
                        type: {
                        name: 'Composite',
                        className: 'InboundNatRule'
                        }
                    }
                }
                },
                inboundNatPools: {
                required: false,
                serializedName: 'properties.inboundNatPools',
                type: {
                    name: 'Sequence',
                    element: {
                        required: false,
                        serializedName: 'InboundNatPoolElementType',
                        type: {
                        name: 'Composite',
                        className: 'InboundNatPool'
                        }
                    }
                }
                },
                outboundNatRules: {
                required: false,
                serializedName: 'properties.outboundNatRules',
                type: {
                    name: 'Sequence',
                    element: {
                        required: false,
                        serializedName: 'OutboundNatRuleElementType',
                        type: {
                        name: 'Composite',
                        className: 'OutboundNatRule'
                        }
                    }
                }
                },
                resourceGuid: {
                required: false,
                serializedName: 'properties.resourceGuid',
                type: {
                    name: 'String'
                }
                },
                provisioningState: {
                required: false,
                serializedName: 'properties.provisioningState',
                type: {
                    name: 'String'
                }
                },
                etag: {
                required: false,
                serializedName: 'etag',
                type: {
                    name: 'String'
                }
                }
            }
            }
        };
    }
}

export class PublicIPAddressListResultModel{
    constructor(){}

    public mapper(){
        return {
            required: false,
            serializedName: 'PublicIPAddressListResult',
            type: {
            name: 'Composite',
            className: 'PublicIPAddressListResult',
            modelProperties: {
                value: {
                required: false,
                serializedName: '',
                type: {
                    name: 'Sequence',
                    element: {
                        required: false,
                        serializedName: 'PublicIPAddressElementType',
                        type: {
                        name: 'Composite',
                        className: 'PublicIPAddress'
                        }
                    }
                }
                },
                nextLink: {
                required: false,
                serializedName: 'nextLink',
                type: {
                    name: 'String'
                }
                }
            }
            }
        };
    }
}

export class loadBalancers{
    private client;

    constructor(client){
        this.client = client;
    }

    public list(resourceGroupName, options, callback){
          var client = this.client;

        if(!callback && typeof options === 'function') {
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
            if (this.client.apiVersion === null || this.client.apiVersion === undefined || typeof this.client.apiVersion.valueOf() !== 'string') {
                throw new Error('this.client.apiVersion cannot be null or undefined and it must be of type string.');
            }
            if (this.client.subscriptionId === null || this.client.subscriptionId === undefined || typeof this.client.subscriptionId.valueOf() !== 'string') {
                throw new Error('this.client.subscriptionId cannot be null or undefined and it must be of type string.');
            }
            if (this.client.acceptLanguage !== null && this.client.acceptLanguage !== undefined && typeof this.client.acceptLanguage.valueOf() !== 'string') {
                throw new Error('this.client.acceptLanguage must be of type string.');
            }
        } catch (error) {
            return callback(error);
        }

        // Construct URL
        var requestUrl = this.client.baseUri +
                        '//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Network/loadBalancers';
        requestUrl = requestUrl.replace('{resourceGroupName}', encodeURIComponent(resourceGroupName));
        requestUrl = requestUrl.replace('{subscriptionId}', encodeURIComponent(this.client.subscriptionId));
        // trim all duplicate forward slashes in the url
        var regex = /([^:]\/)\/+/gi;
        requestUrl = requestUrl.replace(regex, '$1');
        var queryParameters = [];
        queryParameters.push('api-version=' + encodeURIComponent(this.client.apiVersion));
        if (queryParameters.length > 0) {
            requestUrl += '?' + queryParameters.join('&');
        }

        // Create HTTP transport objects
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = {};
        httpRequest.uri = requestUrl;
        // Set Headers
        if (this.client.generateClientRequestId) {
            httpRequest.headers['x-ms-client-request-id'] = msRestAzure.generateUuid();
        }
        if (this.client.acceptLanguage !== undefined && this.client.acceptLanguage !== null) {
            httpRequest.headers['accept-language'] = this.client.acceptLanguage;
        }
        if(options) {
            for(var headerName in options['customHeaders']) {
                if (options['customHeaders'].hasOwnProperty(headerName)) {
                    httpRequest.headers[headerName] = options['customHeaders'][headerName];
                }
            }
        }
        httpRequest.headers['Content-Type'] = 'application/json; charset=utf-8';
        httpRequest.body = null;

        //send request
        this.client.httpObj.get(httpRequest.method, httpRequest.uri, httpRequest.headers, (err, response, responseBody) => { 
            if (err) {
                return callback(err);
            }

            var statusCode = response.statusCode;
            if (statusCode !== 200) {
                var error = new Error(responseBody);
                // error.statusCode = response.statusCode;
                // error.request = msRest.stripRequest(httpRequest);
                // error.response = msRest.stripResponse(response);
                if (responseBody === '') responseBody = null;
                var parsedErrorResponse;
                try {
                    parsedErrorResponse = JSON.parse(responseBody);
                    if (parsedErrorResponse) {
                        if (parsedErrorResponse.error) parsedErrorResponse = parsedErrorResponse.error;
                        //if (parsedErrorResponse.code) error.code = parsedErrorResponse.code;
                        //if (parsedErrorResponse.message) error.message = parsedErrorResponse.message;
                    }
                    if (parsedErrorResponse !== null && parsedErrorResponse !== undefined) {
                        var resultMapper = new client.models['CloudError']().mapper();
                        //error.body = client.deserialize(resultMapper, parsedErrorResponse, 'error.body');
                    }
                } catch (defaultError) {
                    error.message = util.format('Error "%s" occurred in deserializing the responseBody ' + 
                                    '- "%s" for the default response.', defaultError.message, responseBody);
                    return callback(error);
                }
                return callback(error);
            }
            // Create Result
            var result = null;
            if (responseBody === '') responseBody = null;
            // Deserialize Response
            if (statusCode === 200) {
                var parsedResponse = null;
                try {
                    parsedResponse = JSON.parse(responseBody);
                    result = JSON.parse(responseBody);
                    if (parsedResponse !== null && parsedResponse !== undefined) {
                        var resultMapper = client.models['LoadBalancerListResult'].mapper();
                        //result = client.deserialize(resultMapper, parsedResponse, 'result');
                    }
                } catch (error) {
                    var deserializationError = new Error(util.format('Error "%s" occurred in deserializing the responseBody - "%s"', error, responseBody));
                    // deserializationError.request = msRest.stripRequest(httpRequest);
                    // deserializationError.response = msRest.stripResponse(response);
                    return callback(deserializationError);
                }
            }
            return callback(null, result, httpRequest, response);
        });
    }

    public get(resourceGroupName, loadBalancerName, options, callback){
        var client = this.client;
        if(!callback && typeof options === 'function') {
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
            if (this.client.apiVersion === null || this.client.apiVersion === undefined || typeof this.client.apiVersion.valueOf() !== 'string') {
                throw new Error('this.client.apiVersion cannot be null or undefined and it must be of type string.');
            }
            if (this.client.subscriptionId === null || this.client.subscriptionId === undefined || typeof this.client.subscriptionId.valueOf() !== 'string') {
                throw new Error('this.client.subscriptionId cannot be null or undefined and it must be of type string.');
            }
            if (expand !== null && expand !== undefined && typeof expand.valueOf() !== 'string') {
                throw new Error('expand must be of type string.');
            }
            if (this.client.acceptLanguage !== null && this.client.acceptLanguage !== undefined && typeof this.client.acceptLanguage.valueOf() !== 'string') {
                throw new Error('this.client.acceptLanguage must be of type string.');
            }
        } catch (error) {
            return callback(error);
        }

        // Construct URL
        var requestUrl = this.client.baseUri +
                        '//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Network/loadBalancers/{loadBalancerName}';
        requestUrl = requestUrl.replace('{resourceGroupName}', encodeURIComponent(resourceGroupName));
        requestUrl = requestUrl.replace('{loadBalancerName}', encodeURIComponent(loadBalancerName));
        requestUrl = requestUrl.replace('{subscriptionId}', encodeURIComponent(this.client.subscriptionId));
        // trim all duplicate forward slashes in the url
        var regex = /([^:]\/)\/+/gi;
        requestUrl = requestUrl.replace(regex, '$1');
        var queryParameters = [];
        queryParameters.push('api-version=' + encodeURIComponent(this.client.apiVersion));
        if (expand !== null && expand !== undefined) {
            queryParameters.push('$expand=' + encodeURIComponent(expand));
        }
        if (queryParameters.length > 0) {
            requestUrl += '?' + queryParameters.join('&');
        }

        // Create HTTP transport objects
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = {
            authorization: 'Bearer ' + this.client.credentials
        };
        httpRequest.uri = requestUrl;
        // Set Headers
        if (this.client.generateClientRequestId) {
            httpRequest.headers['x-ms-client-request-id'] = msRestAzure.generateUuid();
        }
        if (this.client.acceptLanguage !== undefined && this.client.acceptLanguage !== null) {
            httpRequest.headers['accept-language'] = this.client.acceptLanguage;
        }
        if(options) {
            for(var headerName in options['customHeaders']) {
                if (options['customHeaders'].hasOwnProperty(headerName)) {
                    httpRequest.headers[headerName] = options['customHeaders'][headerName];
                }
            }
        }
        httpRequest.headers['Content-Type'] = 'application/json; charset=utf-8';
        httpRequest.body = null;

        this.client.httpObj.get(httpRequest.method, httpRequest.uri, httpRequest.headers, (err, response, responseBody) => { 
            if (err) {
                return callback(err);
            }
            console.log("statusCode: %s", response.statusCode);
            console.log("Response: %s", responseBody);
            var statusCode = response.statusCode;
            if (statusCode !== 200) {
                var error = new Error(responseBody);
                // error.statusCode = response.statusCode;
                // error.request = msRest.stripRequest(httpRequest);
                // error.response = msRest.stripResponse(response);
                if (responseBody === '') responseBody = null;
                var parsedErrorResponse;
                try {
                    parsedErrorResponse = JSON.parse(responseBody);
                    if (parsedErrorResponse) {
                    if (parsedErrorResponse.error) parsedErrorResponse = parsedErrorResponse.error;
                    // if (parsedErrorResponse.code) error.code = parsedErrorResponse.code;
                    // if (parsedErrorResponse.message) error.message = parsedErrorResponse.message;
                    }
                    if (parsedErrorResponse !== null && parsedErrorResponse !== undefined) {
                    var resultMapper = client.models['CloudError'].mapper();
                    // error.body = client.deserialize(resultMapper, parsedErrorResponse, 'error.body');
                    }
                } catch (defaultError) {
                    error.message = util.format('Error "%s" occurred in deserializing the responseBody ' + 
                                    '- "%s" for the default response.', defaultError.message, responseBody);
                    return callback(error);
                }
                return callback(error);
            }
            // Create Result
            var result = null;
            if (responseBody === '') responseBody = null;
            // Deserialize Response
            if (statusCode === 200) {
                var parsedResponse = null;
                try {
                    parsedResponse = JSON.parse(responseBody);
                    result = JSON.parse(responseBody);
                    if (parsedResponse !== null && parsedResponse !== undefined) {
                        var resultMapper = client.models['LoadBalancer'].mapper();
                        // result = client.deserialize(resultMapper, parsedResponse, 'result');
                    }
                } catch (error) {
                    var deserializationError = new Error(util.format('Error "%s" occurred in deserializing the responseBody - "%s"', error, responseBody));
                    // deserializationError.request = msRest.stripRequest(httpRequest);
                    // deserializationError.response = msRest.stripResponse(response);
                    return callback(deserializationError);
                }
            }
            return callback(null, result, httpRequest, response);
        });
    }
}

export class publicIPAddresses{
    private client;
    constructor(client){
        this.client = client;
    }

    public list(resourceGroupName, options, callback){
        var client = this.client;
        if(!callback && typeof options === 'function') {
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
            if (this.client.apiVersion === null || this.client.apiVersion === undefined || typeof this.client.apiVersion.valueOf() !== 'string') {
            throw new Error('this.client.apiVersion cannot be null or undefined and it must be of type string.');
            }
            if (this.client.subscriptionId === null || this.client.subscriptionId === undefined || typeof this.client.subscriptionId.valueOf() !== 'string') {
            throw new Error('this.client.subscriptionId cannot be null or undefined and it must be of type string.');
            }
            if (this.client.acceptLanguage !== null && this.client.acceptLanguage !== undefined && typeof this.client.acceptLanguage.valueOf() !== 'string') {
            throw new Error('this.client.acceptLanguage must be of type string.');
            }
        } catch (error) {
            return callback(error);
        }

        // Construct URL
        var requestUrl = this.client.baseUri +
                        '//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Network/publicIPAddresses';
        requestUrl = requestUrl.replace('{resourceGroupName}', encodeURIComponent(resourceGroupName));
        requestUrl = requestUrl.replace('{subscriptionId}', encodeURIComponent(this.client.subscriptionId));
        // trim all duplicate forward slashes in the url
        var regex = /([^:]\/)\/+/gi;
        requestUrl = requestUrl.replace(regex, '$1');
        var queryParameters = [];
        queryParameters.push('api-version=' + encodeURIComponent(this.client.apiVersion));
        if (queryParameters.length > 0) {
            requestUrl += '?' + queryParameters.join('&');
        }

        // Create HTTP transport objects
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = {
            authorization: 'Bearer ' + client.credentials
        };
        httpRequest.uri = requestUrl;
        // Set Headers
        if (this.client.generateClientRequestId) {
            httpRequest.headers['x-ms-client-request-id'] = msRestAzure.generateUuid();
        }
        if (this.client.acceptLanguage !== undefined && this.client.acceptLanguage !== null) {
            httpRequest.headers['accept-language'] = this.client.acceptLanguage;
        }
        if(options) {
            for(var headerName in options['customHeaders']) {
                if (options['customHeaders'].hasOwnProperty(headerName)) {
                    httpRequest.headers[headerName] = options['customHeaders'][headerName];
                }
            }
        }
        httpRequest.headers['Content-Type'] = 'application/json; charset=utf-8';
        httpRequest.body = null;

        this.client.httpObj.get(httpRequest.method, httpRequest.uri, httpRequest.headers, (err, response, responseBody) => { 
            if (err) {
                return callback(err);
            }
            console.log("statusCode: %s", response.statusCode);
            console.log("Response: %s", responseBody);
            var statusCode = response.statusCode;
            if (statusCode !== 200) {
            var error = new Error(responseBody);
            // error.statusCode = response.statusCode;
            // error.request = msRest.stripRequest(httpRequest);
            // error.response = msRest.stripResponse(response);
            if (responseBody === '') responseBody = null;
            var parsedErrorResponse;
            try {
                parsedErrorResponse = JSON.parse(responseBody);
                if (parsedErrorResponse) {
                    if (parsedErrorResponse.error) parsedErrorResponse = parsedErrorResponse.error;
                    // if (parsedErrorResponse.code) error.code = parsedErrorResponse.code;
                    // if (parsedErrorResponse.message) error.message = parsedErrorResponse.message;
                }
                if (parsedErrorResponse !== null && parsedErrorResponse !== undefined) {
                    var resultMapper = client.models['CloudError'].mapper();
                    // error.body = client.deserialize(resultMapper, parsedErrorResponse, 'error.body');
                }
            } catch (defaultError) {
                error.message = util.format('Error "%s" occurred in deserializing the responseBody ' + 
                                '- "%s" for the default response.', defaultError.message, responseBody);
                return callback(error);
            }
            return callback(error);
            }
            // Create Result
            var result = null;
            if (responseBody === '') responseBody = null;
            // Deserialize Response
            if (statusCode === 200) {
                var parsedResponse = null;
                try {
                    parsedResponse = JSON.parse(responseBody);
                    result = JSON.parse(responseBody);
                    if (parsedResponse !== null && parsedResponse !== undefined) {
                        var resultMapper = client.models['PublicIPAddressListResult'].mapper();
                        //result = client.deserialize(resultMapper, parsedResponse, 'result');
                    }
                } catch (error) {
                    var deserializationError = new Error(util.format('Error "%s" occurred in deserializing the responseBody - "%s"', error, responseBody));
                    // deserializationError.request = msRest.stripRequest(httpRequest);
                    // deserializationError.response = msRest.stripResponse(response);
                    return callback(deserializationError);
                }
            }

            return callback(null, result, httpRequest, response);
        });
    }
}

export class networkSecurityGroups{
    private client;
    constructor(client){
        this.client = client;
    }

    public list(resourceGroupName, options, callback){
        var client = this.client;
        if(!callback && typeof options === 'function') {
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
            if (this.client.apiVersion === null || this.client.apiVersion === undefined || typeof this.client.apiVersion.valueOf() !== 'string') {
            throw new Error('this.client.apiVersion cannot be null or undefined and it must be of type string.');
            }
            if (this.client.subscriptionId === null || this.client.subscriptionId === undefined || typeof this.client.subscriptionId.valueOf() !== 'string') {
            throw new Error('this.client.subscriptionId cannot be null or undefined and it must be of type string.');
            }
            if (this.client.acceptLanguage !== null && this.client.acceptLanguage !== undefined && typeof this.client.acceptLanguage.valueOf() !== 'string') {
            throw new Error('this.client.acceptLanguage must be of type string.');
            }
        } catch (error) {
            return callback(error);
        }

        // Construct URL
        var requestUrl = this.client.baseUri +
                        '//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Network/networkSecurityGroups';
        requestUrl = requestUrl.replace('{resourceGroupName}', encodeURIComponent(resourceGroupName));
        requestUrl = requestUrl.replace('{subscriptionId}', encodeURIComponent(this.client.subscriptionId));
        // trim all duplicate forward slashes in the url
        var regex = /([^:]\/)\/+/gi;
        requestUrl = requestUrl.replace(regex, '$1');
        var queryParameters = [];
        queryParameters.push('api-version=' + encodeURIComponent(this.client.apiVersion));
        if (queryParameters.length > 0) {
            requestUrl += '?' + queryParameters.join('&');
        }

        // Create HTTP transport objects
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = {
            authorization: 'Bearer ' + this.client.credentials
        };
        httpRequest.uri = requestUrl;
        // Set Headers
        if (this.client.generateClientRequestId) {
            httpRequest.headers['x-ms-client-request-id'] = msRestAzure.generateUuid();
        }
        if (this.client.acceptLanguage !== undefined && this.client.acceptLanguage !== null) {
            httpRequest.headers['accept-language'] = this.client.acceptLanguage;
        }
        if(options) {
            for(var headerName in options['customHeaders']) {
                if (options['customHeaders'].hasOwnProperty(headerName)) {
                    httpRequest.headers[headerName] = options['customHeaders'][headerName];
                }
            }
        }
        httpRequest.headers['Content-Type'] = 'application/json; charset=utf-8';
        httpRequest.body = null;

        //send request
        this.client.httpObj.get(httpRequest.method, httpRequest.uri, httpRequest.headers, (err, response, responseBody) => { 
            if (err) {
                return callback(err);
            }
            console.log("statusCode: %s", response.statusCode);
            console.log("Response: %s", responseBody);

            var statusCode = response.statusCode;
            if (statusCode !== 200) {
            var error = new Error(responseBody);
            // error.statusCode = response.statusCode;
            // error.request = msRest.stripRequest(httpRequest);
            // error.response = msRest.stripResponse(response);
            if (responseBody === '') responseBody = null;
                var parsedErrorResponse;
                try {
                    parsedErrorResponse = JSON.parse(responseBody);
                    if (parsedErrorResponse) {
                        if (parsedErrorResponse.error) parsedErrorResponse = parsedErrorResponse.error;
                        // if (parsedErrorResponse.code) error.code = parsedErrorResponse.code;
                        // if (parsedErrorResponse.message) error.message = parsedErrorResponse.message;
                    }
                    if (parsedErrorResponse !== null && parsedErrorResponse !== undefined) {
                        var resultMapper = client.models['CloudError'].mapper();
                        //error.body = client.deserialize(resultMapper, parsedErrorResponse, 'error.body');
                    }
                } catch (defaultError) {
                    error.message = util.format('Error "%s" occurred in deserializing the responseBody ' + 
                                    '- "%s" for the default response.', defaultError.message, responseBody);
                    return callback(error);
                }
                return callback(error);
            }
            // Create Result
            var result = null;
            if (responseBody === '') responseBody = null;
            // Deserialize Response
            if (statusCode === 200) {
            var parsedResponse = null;
            try {
                parsedResponse = JSON.parse(responseBody);
                result = JSON.parse(responseBody);
                if (parsedResponse !== null && parsedResponse !== undefined) {
                    var resultMapper = client.models['NetworkSecurityGroupListResult'].mapper();
                    // result = client.deserialize(resultMapper, parsedResponse, 'result');
                }
            } catch (error) {
                var deserializationError = new Error(util.format('Error "%s" occurred in deserializing the responseBody - "%s"', error, responseBody));
                // deserializationError.request = msRest.stripRequest(httpRequest);
                // deserializationError.response = msRest.stripResponse(response);
                return callback(deserializationError);
            }
            }

            return callback(null, result, httpRequest, response);
        });
    }
}

export class NetworkInterfaces{
    private client;
    constructor(client){
        this.client = client;
    }

    public list(resourceGroupName, options, callback){
       var client = this.client;
        if(!callback && typeof options === 'function') {
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
            if (this.client.apiVersion === null || this.client.apiVersion === undefined || typeof this.client.apiVersion.valueOf() !== 'string') {
                throw new Error('this.client.apiVersion cannot be null or undefined and it must be of type string.');
            }
            if (this.client.subscriptionId === null || this.client.subscriptionId === undefined || typeof this.client.subscriptionId.valueOf() !== 'string') {
                throw new Error('this.client.subscriptionId cannot be null or undefined and it must be of type string.');
            }
            if (this.client.acceptLanguage !== null && this.client.acceptLanguage !== undefined && typeof this.client.acceptLanguage.valueOf() !== 'string') {
                throw new Error('this.client.acceptLanguage must be of type string.');
            }
        } catch (error) {
            return callback(error);
        }

        // Construct URL
        var requestUrl = this.client.baseUri +
                        '//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Network/networkInterfaces';
        requestUrl = requestUrl.replace('{resourceGroupName}', encodeURIComponent(resourceGroupName));
        requestUrl = requestUrl.replace('{subscriptionId}', encodeURIComponent(this.client.subscriptionId));
        // trim all duplicate forward slashes in the url
        var regex = /([^:]\/)\/+/gi;
        requestUrl = requestUrl.replace(regex, '$1');
        var queryParameters = [];
        queryParameters.push('api-version=' + encodeURIComponent(this.client.apiVersion));
        if (queryParameters.length > 0) {
            requestUrl += '?' + queryParameters.join('&');
        }
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = {
            authorization: 'Bearer ' + this.client.credentials
        };
        httpRequest.uri = requestUrl; 
        if (this.client.generateClientRequestId) {
            httpRequest.headers['x-ms-client-request-id'] = msRestAzure.generateUuid();
        }
        if (this.client.acceptLanguage !== undefined && this.client.acceptLanguage !== null) {
            httpRequest.headers['accept-language'] = this.client.acceptLanguage;
        }
        if(options) {
            for(var headerName in options['customHeaders']) {
            if (options['customHeaders'].hasOwnProperty(headerName)) {
                httpRequest.headers[headerName] = options['customHeaders'][headerName];
            }
            }
        }
        httpRequest.headers['Content-Type'] = 'application/json; charset=utf-8';
        httpRequest.body = null;
        // Send Request
        this.client.httpObj.get(httpRequest.method, httpRequest.uri, httpRequest.headers, (err, response, responseBody) => { 
            if (err) {
                return callback(err);
            }
            console.log("statusCode: %s", response.statusCode);
            console.log("Response: %s", responseBody);
            var statusCode = response.statusCode;
            if (statusCode !== 200) {
                var error = new Error(responseBody);
                // error.statusCode = response.statusCode;
                // error.request = msRest.stripRequest(httpRequest);
                // error.response = msRest.stripResponse(response);
                if (responseBody === '') responseBody = null;
                var parsedErrorResponse;
                try {
                    parsedErrorResponse = JSON.parse(responseBody);
                    if (parsedErrorResponse) {
                        if (parsedErrorResponse.error) parsedErrorResponse = parsedErrorResponse.error;
                        // if (parsedErrorResponse.code) error.code = parsedErrorResponse.code;
                        // if (parsedErrorResponse.message) error.message = parsedErrorResponse.message;
                    }
                    if (parsedErrorResponse !== null && parsedErrorResponse !== undefined) {
                        var resultMapper = client.models['CloudError'].mapper();
                        // error.body = client.deserialize(resultMapper, parsedErrorResponse, 'error.body');
                    }
                } catch (defaultError) {
                    error.message = util.format('Error "%s" occurred in deserializing the responseBody ' + 
                                    '- "%s" for the default response.', defaultError.message, responseBody);
                    return callback(error);
                }
                return callback(error);
            }
            // Create Result
            var result = null;
            if (responseBody === '') responseBody = null;
            // Deserialize Response
            if (statusCode === 200) {
                var parsedResponse = null;
                try {
                    parsedResponse = JSON.parse(responseBody);
                    result = JSON.parse(responseBody);
                    if (parsedResponse !== null && parsedResponse !== undefined) {
                        var resultMapper = client.models['NetworkInterfaceListResult'].mapper();
                        // result = client.deserialize(resultMapper, parsedResponse, 'result');
                    }
                } catch (error) {
                    var deserializationError = new Error(util.format('Error "%s" occurred in deserializing the responseBody - "%s"', error, responseBody));
                    // deserializationError.request = msRest.stripRequest(httpRequest);
                    // deserializationError.response = msRest.stripResponse(response);
                    return callback(deserializationError);
                }
            }

            return callback(null, result, httpRequest, response);
        });        
    }
}

export class securityRules{
    private client;
    constructor(client){
        this.client = client;
    }

    public get(resourceGroupName, networkSecurityGroupName, securityRuleName, options, callback){
        var client = this.client;
        if(!callback && typeof options === 'function') {
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
            if (this.client.apiVersion === null || this.client.apiVersion === undefined || typeof this.client.apiVersion.valueOf() !== 'string') {
                throw new Error('this.client.apiVersion cannot be null or undefined and it must be of type string.');
            }
            if (this.client.subscriptionId === null || this.client.subscriptionId === undefined || typeof this.client.subscriptionId.valueOf() !== 'string') {
                throw new Error('this.client.subscriptionId cannot be null or undefined and it must be of type string.');
            }
            if (this.client.acceptLanguage !== null && this.client.acceptLanguage !== undefined && typeof this.client.acceptLanguage.valueOf() !== 'string') {
                throw new Error('this.client.acceptLanguage must be of type string.');
            }
        } catch (error) {
            return callback(error);
        }

        // Construct URL
        var requestUrl = this.client.baseUri +
                        '//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Network/networkSecurityGroups/{networkSecurityGroupName}/securityRules/{securityRuleName}';
        requestUrl = requestUrl.replace('{resourceGroupName}', encodeURIComponent(resourceGroupName));
        requestUrl = requestUrl.replace('{networkSecurityGroupName}', encodeURIComponent(networkSecurityGroupName));
        requestUrl = requestUrl.replace('{securityRuleName}', encodeURIComponent(securityRuleName));
        requestUrl = requestUrl.replace('{subscriptionId}', encodeURIComponent(this.client.subscriptionId));
        // trim all duplicate forward slashes in the url
        var regex = /([^:]\/)\/+/gi;
        requestUrl = requestUrl.replace(regex, '$1');
        var queryParameters = [];
        queryParameters.push('api-version=' + encodeURIComponent(this.client.apiVersion));
        if (queryParameters.length > 0) {
            requestUrl += '?' + queryParameters.join('&');
        }

        // Create HTTP transport objects
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = {
            authorization: 'Bearer ' + client.credentials
        };
        httpRequest.uri = requestUrl;
        // Set Headers
        if (this.client.generateClientRequestId) {
            httpRequest.headers['x-ms-client-request-id'] = msRestAzure.generateUuid();
        }
        if (this.client.acceptLanguage !== undefined && this.client.acceptLanguage !== null) {
            httpRequest.headers['accept-language'] = this.client.acceptLanguage;
        }
        if(options) {
            for(var headerName in options['customHeaders']) {
                if (options['customHeaders'].hasOwnProperty(headerName)) {
                    httpRequest.headers[headerName] = options['customHeaders'][headerName];
                }
            }
        }
        httpRequest.headers['Content-Type'] = 'application/json; charset=utf-8';
        httpRequest.body = null;
        // Send Request
        //var clientUtils = new azureServiceClient.Utils();
        this.client.httpObj.get(httpRequest.method, httpRequest.uri, httpRequest.headers, (err, response, responseBody) => { 
            if (err) {
                return callback(err);
            }
            console.log("statusCode: %s", response.statusCode);
            console.log("Response: %s", responseBody);
            var statusCode = response.statusCode;
            if (statusCode !== 200) {
                var error = new msRestAzure.Error(responseBody);
                error.statusCode = response.statusCode;
                error.request =  new msRestAzure.stripRequest(httpRequest);
                error.response = new msRestAzure.stripResponse(response);
                if (responseBody === '') responseBody = null;
                var parsedErrorResponse;
                try {
                    parsedErrorResponse = JSON.parse(responseBody);
                    if (parsedErrorResponse) {
                        if (parsedErrorResponse.error) parsedErrorResponse = parsedErrorResponse.error;
                        if (parsedErrorResponse.code) error.code = parsedErrorResponse.code;
                        if (parsedErrorResponse.message) error.message = parsedErrorResponse.message;
                    }
                    if (parsedErrorResponse !== null && parsedErrorResponse !== undefined) {
                        var resultMapper = client.models['CloudError'].mapper();
                        //error.body = clientUtils.deserialize(resultMapper, parsedErrorResponse, 'error.body');
                    }
                } catch (defaultError) {
                    error.message = util.format('Error "%s" occurred in deserializing the responseBody ' + 
                                    '- "%s" for the default response.', defaultError.message, responseBody);
                    return callback(error);
                }
                return callback(error);
            }
            // Create Result
            var result = null;
            if (responseBody === '') responseBody = null;
            // Deserialize Response
            if (statusCode === 200) {
                var parsedResponse = null;
                try {
                    parsedResponse = JSON.parse(responseBody);
                    result = JSON.parse(responseBody);
                    if (parsedResponse !== null && parsedResponse !== undefined) {
                        var resultMapper = client.models['SecurityRule'].mapper();
                        //result = clientUtils.deserialize(resultMapper, parsedResponse, 'result');
                    }
                } catch (error) {
                    var deserializationError = new msRestAzure.Error(util.format('Error "%s" occurred in deserializing the responseBody - "%s"', error, responseBody));
                    deserializationError.request = new msRestAzure.stripRequest(httpRequest);
                    deserializationError.response = new msRestAzure.stripResponse(response);
                    return callback(deserializationError);
                }
            }

            return callback(null, result, httpRequest, response);
        });
    }   
}