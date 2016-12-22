import msRestAzure = require("./ms-rest-azure");
import tl = require('vsts-task-lib/task');
import util = require("util");
import azureServiceClient = require("./AzureServiceClient");
import httpClient = require('vso-node-api/HttpClient');
import restClient = require('vso-node-api/RestClient');

export class ComputeManagementClient {
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
    public virtualMachines;
    public virtualMachineExtensions;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId, baseUri?: any, options?: any) {
        this.acceptLanguage = 'en-US';
        this.longRunningOperationRetryTimeout = 30;
        this.generateClientRequestId = true;
        this.models = {};

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
        this.models['VirtualMachineListResult'] = new VirtualMachineListResultModel();
        this.models['VirtualMachine'] = new VirtualMachineModel();
        this.models['CloudError'] = new msRestAzure.CloudError();
        this.models['VirtualMachineExtension'] = new VirtualMachineExtensionModel();
    }
}

export class VirtualMachineListResultModel {
    constructor() {
    }

    mapper() {
        return {
            required: false,
            serializedName: 'VirtualMachineListResult',
            type: {
                name: 'Composite',
                className: 'VirtualMachineListResult',
                modelProperties: {
                    value: {
                        required: false,
                        serializedName: '',
                        type: {
                            name: 'Sequence',
                            element: {
                                required: false,
                                serializedName: 'VirtualMachineElementType',
                                type: {
                                    name: 'Composite',
                                    className: 'VirtualMachine'
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
        }
    }
}

export class VirtualMachineModel {
    constructor() {
    }

    public mapper() {
        return {
            required: false,
            serializedName: 'VirtualMachine',
            type: {
                name: 'Composite',
                className: 'VirtualMachine',
                modelProperties: {
                    id: {
                        required: false,
                        readOnly: true,
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
                        required: true,
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
                    plan: {
                        required: false,
                        serializedName: 'plan',
                        type: {
                            name: 'Composite',
                            className: 'Plan'
                        }
                    },
                    hardwareProfile: {
                        required: false,
                        serializedName: 'properties.hardwareProfile',
                        type: {
                            name: 'Composite',
                            className: 'HardwareProfile'
                        }
                    },
                    storageProfile: {
                        required: false,
                        serializedName: 'properties.storageProfile',
                        type: {
                            name: 'Composite',
                            className: 'StorageProfile'
                        }
                    },
                    osProfile: {
                        required: false,
                        serializedName: 'properties.osProfile',
                        type: {
                            name: 'Composite',
                            className: 'OSProfile'
                        }
                    },
                    networkProfile: {
                        required: false,
                        serializedName: 'properties.networkProfile',
                        type: {
                            name: 'Composite',
                            className: 'NetworkProfile'
                        }
                    },
                    diagnosticsProfile: {
                        required: false,
                        serializedName: 'properties.diagnosticsProfile',
                        type: {
                            name: 'Composite',
                            className: 'DiagnosticsProfile'
                        }
                    },
                    availabilitySet: {
                        required: false,
                        serializedName: 'properties.availabilitySet',
                        type: {
                            name: 'Composite',
                            className: 'SubResource'
                        }
                    },
                    provisioningState: {
                        required: false,
                        readOnly: true,
                        serializedName: 'properties.provisioningState',
                        type: {
                            name: 'String'
                        }
                    },
                    instanceView: {
                        required: false,
                        readOnly: true,
                        serializedName: 'properties.instanceView',
                        type: {
                            name: 'Composite',
                            className: 'VirtualMachineInstanceView'
                        }
                    },
                    licenseType: {
                        required: false,
                        serializedName: 'properties.licenseType',
                        type: {
                            name: 'String'
                        }
                    },
                    vmId: {
                        required: false,
                        readOnly: true,
                        serializedName: 'properties.vmId',
                        type: {
                            name: 'String'
                        }
                    },
                    resources: {
                        required: false,
                        readOnly: true,
                        serializedName: 'resources',
                        type: {
                            name: 'Sequence',
                            element: {
                                required: false,
                                serializedName: 'VirtualMachineExtensionElementType',
                                type: {
                                    name: 'Composite',
                                    className: 'VirtualMachineExtension'
                                }
                            }
                        }
                    }
                }
            }
        };
    }
}

export class VirtualMachineExtensionModel {
    constructor() { }

    public mapper() {
        return {
            required: false,
            serializedName: 'VirtualMachineExtension',
            type: {
                name: 'Composite',
                className: 'VirtualMachineExtension',
                modelProperties: {
                    id: {
                        required: false,
                        readOnly: true,
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
                        required: true,
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
                    forceUpdateTag: {
                        required: false,
                        serializedName: 'properties.forceUpdateTag',
                        type: {
                            name: 'String'
                        }
                    },
                    publisher: {
                        required: false,
                        serializedName: 'properties.publisher',
                        type: {
                            name: 'String'
                        }
                    },
                    virtualMachineExtensionType: {
                        required: false,
                        serializedName: 'properties.type',
                        type: {
                            name: 'String'
                        }
                    },
                    typeHandlerVersion: {
                        required: false,
                        serializedName: 'properties.typeHandlerVersion',
                        type: {
                            name: 'String'
                        }
                    },
                    autoUpgradeMinorVersion: {
                        required: false,
                        serializedName: 'properties.autoUpgradeMinorVersion',
                        type: {
                            name: 'Boolean'
                        }
                    },
                    settings: {
                        required: false,
                        serializedName: 'properties.settings',
                        type: {
                            name: 'Object'
                        }
                    },
                    protectedSettings: {
                        required: false,
                        serializedName: 'properties.protectedSettings',
                        type: {
                            name: 'Object'
                        }
                    },
                    provisioningState: {
                        required: false,
                        readOnly: true,
                        serializedName: 'properties.provisioningState',
                        type: {
                            name: 'String'
                        }
                    },
                    instanceView: {
                        required: false,
                        serializedName: 'properties.instanceView',
                        type: {
                            name: 'Composite',
                            className: 'VirtualMachineExtensionInstanceView'
                        }
                    }
                }
            }
        };
    }
}

export class VirtualMachines {
    private client;

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
        var apiVersion = '2016-03-30';
        // Validate
        try {
            if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
                throw new Error('resourceGroupName cannot be null or undefined and it must be of type string.');
            }
            if (this.client.subscriptionId === null || this.client.subscriptionId === undefined || typeof this.client.subscriptionId.valueOf() !== 'string') {
                throw new Error('this.client.subscriptionId cannot be null or undefined and it must be of type string.');
            }
            if (this.client.acceptLanguage !== null && this.client.acceptLanguage !== undefined && typeof this.client.acceptLanguage.valueOf() !== 'string') {
                throw new Error('this.client.acceptLanguage must be of type string.');
            }
        }
        catch (error) {
            return callback(error);
        }
        // Construct URL
        var requestUrl = this.client.baseUri +
            '//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines';
        requestUrl = requestUrl.replace('{resourceGroupName}', encodeURIComponent(resourceGroupName));
        requestUrl = requestUrl.replace('{subscriptionId}', encodeURIComponent(this.client.subscriptionId));

        var queryParameters = [];
        queryParameters.push('api-version=' + encodeURIComponent(apiVersion));
        if (queryParameters.length > 0) {
            requestUrl += '?' + queryParameters.join('&');
        }
        // trim all duplicate forward slashes in the url
        var regex = /([^:]\/)\/+/gi;
        requestUrl = requestUrl.replace(regex, '$1');

        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = {
            authorization: 'Bearer ' + this.client.credentials
        };
        httpRequest.uri = requestUrl;
        if (options) {
            for (var headerName in options['customHeaders']) {
                if (options['customHeaders'].hasOwnProperty(headerName)) {
                    httpRequest.headers[headerName] = options['customHeaders'][headerName];
                }
            }
        }
        httpRequest.headers['Content-Type'] = 'application/json; charset=utf-8';
        httpRequest.body = null;

        var serviceClient = new azureServiceClient.ServiceClient(this.client.credentials);
        // serviceClient.get(httpRequest).then((response) => {
        //     var statusCode = response.statusCode;
        //     if (statusCode != 200) {
        //         // var error = new Error(responseBody);
        //         // if (responseBody === '') {
        //         //     responseBody = null;
        //         // }
        //     }
        //     var result = null;
        //     // if (responseBody === '') {
        //     //     responseBody = null;
        //     // }
        //     if (statusCode === 200) {
        //         var parsedResponse = null;
        //         try {
        //             // result = JSON.parse(responseBody);
        //             if (parsedResponse != null && parsedResponse != undefined) {
        //                 var resultMapper = this.client.models['VirtualMachineListResult'].mapper();
        //             }
        //         }
        //         catch (error) {
        //             var deserializationError = new Error(util.format('Error "%s" occurred in deserializing the responseBody - "%s"', response));
        //             return callback(deserializationError);
        //         }
        //     }
        //     return callback(null, result, requestUrl, response);
        // });
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
            '//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}';
        requestUrl = requestUrl.replace('{resourceGroupName}', encodeURIComponent(resourceGroupName));
        requestUrl = requestUrl.replace('{vmName}', encodeURIComponent(vmName));
        requestUrl = requestUrl.replace('{subscriptionId}', encodeURIComponent(this.client.subscriptionId));
        var queryParameters = [];
        if (expand !== null && expand !== undefined) {
            queryParameters.push('$expand=' + encodeURIComponent(expand));
        }
        queryParameters.push('api-version=' + encodeURIComponent(apiVersion));
        if (queryParameters.length > 0) {
            requestUrl += '?' + queryParameters.join('&');
        }
        // trim all duplicate forward slashes in the url
        var regex = /([^:]\/)\/+/gi;
        requestUrl = requestUrl.replace(regex, '$1');

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
        if (options) {
            for (var headerName in options['customHeaders']) {
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

            var statusCode = response.statusCode;
            if (statusCode !== 200) {
                var error = new Error(responseBody);

                if (responseBody === '') responseBody = null;
                var parsedErrorResponse;
                try {
                    parsedErrorResponse = JSON.parse(responseBody);
                    if (parsedErrorResponse) {
                        if (parsedErrorResponse.error) parsedErrorResponse = parsedErrorResponse.error;
                        //     if (parsedErrorResponse.code) error.code = parsedErrorResponse.code;
                        //     if (parsedErrorResponse.message) error.message = parsedErrorResponse.message;
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
                        var resultMapper = client.models['VirtualMachine'].mapper();
                        result = client.deserialize(resultMapper, parsedResponse, 'result');
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
            if (this.client.subscriptionId === null || this.client.subscriptionId === undefined || typeof this.client.subscriptionId.valueOf() !== 'string') {
                throw new Error('this.client.subscriptionId cannot be null or undefined and it must be of type string.');
            }
        } catch (error) {
            return callback(error);
        }

        // Construct URL
        var requestUrl = this.client.baseUri +
            '//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}/restart';
        requestUrl = requestUrl.replace('{resourceGroupName}', encodeURIComponent(resourceGroupName));
        requestUrl = requestUrl.replace('{vmName}', encodeURIComponent(vmName));
        requestUrl = requestUrl.replace('{subscriptionId}', encodeURIComponent(this.client.subscriptionId));
        var queryParameters = [];
        queryParameters.push('api-version=' + encodeURIComponent(apiVersion));
        if (queryParameters.length > 0) {
            requestUrl += '?' + queryParameters.join('&');
        }
        // trim all duplicate forward slashes in the url
        var regex = /([^:]\/)\/+/gi;
        requestUrl = requestUrl.replace(regex, '$1');

        // Create object
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.headers = {};
        httpRequest.uri = requestUrl;
        // Set Headers
        if (this.client.generateClientRequestId) {
            httpRequest.headers['x-ms-client-request-id'] = msRestAzure.generateUuid();
        }
        if (this.client.acceptLanguage !== undefined && this.client.acceptLanguage !== null) {
            httpRequest.headers['accept-language'] = this.client.acceptLanguage;
        }
        httpRequest.headers['Content-Type'] = 'application/json; charset=utf-8';
        httpRequest.body = null;
        var serviceClient = new azureServiceClient.ServiceClient(this.client.credentials);
        serviceClient.request(httpRequest).then((response: azureServiceClient.WebResponse) => {
            if (response.error) {
                callback(response.error);
            }
            serviceClient.getLongRunningOperationResult(response).then((operationResponse: azureServiceClient.WebResponse) => {
                if (operationResponse.body.status === "Succeeded") {
                    callback(null, operationResponse);
                } else {
                    var error = new azureServiceClient.Error();
                    error.statusCode = response.statusCode;
                    if (response.body === '') response.body = null;
                    var parsedErrorResponse;
                    try {
                        parsedErrorResponse = response.body;
                        if (parsedErrorResponse) {
                            if (parsedErrorResponse.error) parsedErrorResponse = parsedErrorResponse.error;
                            if (parsedErrorResponse.code) error.code = parsedErrorResponse.code;
                            if (parsedErrorResponse.message) error.message = parsedErrorResponse.message;
                        }
                    } catch (defaultError) {
                        error.message = util.format('Error "%s" occurred in deserializing the responseBody ' +
                            '- "%s" for the default response.', defaultError.message, response.body);
                        return callback(error);
                    }
                    return callback(error);
                }
            });
        });
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
            if (this.client.subscriptionId === null || this.client.subscriptionId === undefined || typeof this.client.subscriptionId.valueOf() !== 'string') {
                throw new Error('this.client.subscriptionId cannot be null or undefined and it must be of type string.');
            }
        } catch (error) {
            return callback(error);
        }

        // Construct URL
        var requestUrl = this.client.baseUri +
            '//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}/start';
        requestUrl = requestUrl.replace('{resourceGroupName}', encodeURIComponent(resourceGroupName));
        requestUrl = requestUrl.replace('{vmName}', encodeURIComponent(vmName));
        requestUrl = requestUrl.replace('{subscriptionId}', encodeURIComponent(this.client.subscriptionId));
        var queryParameters = [];
        queryParameters.push('api-version=' + encodeURIComponent(apiVersion));
        if (queryParameters.length > 0) {
            requestUrl += '?' + queryParameters.join('&');
        }
        // trim all duplicate forward slashes in the url
        var regex = /([^:]\/)\/+/gi;
        requestUrl = requestUrl.replace(regex, '$1');

        // Create object
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.headers = {};
        httpRequest.uri = requestUrl;
        // Set Headers
        if (this.client.generateClientRequestId) {
            httpRequest.headers['x-ms-client-request-id'] = msRestAzure.generateUuid();
        }
        if (this.client.acceptLanguage !== undefined && this.client.acceptLanguage !== null) {
            httpRequest.headers['accept-language'] = this.client.acceptLanguage;
        }
        httpRequest.headers['Content-Type'] = 'application/json; charset=utf-8';
        httpRequest.body = null;
        var serviceClient = new azureServiceClient.ServiceClient(this.client.credentials);
        serviceClient.request(httpRequest).then((response: azureServiceClient.WebResponse) => {
            if (response.error) {
                callback(response.error);
            }
            serviceClient.getLongRunningOperationResult(response).then((operationResponse: azureServiceClient.WebResponse) => {
                if (operationResponse.body.status === "Succeeded") {
                    // Generate Response
                    callback(null);
                } else {
                    var error = new azureServiceClient.Error();
                    error.statusCode = response.statusCode;
                    if (response.body === '') response.body = null;
                    var parsedErrorResponse;
                    try {
                        parsedErrorResponse = response.body;
                        if (parsedErrorResponse) {
                            if (parsedErrorResponse.error) parsedErrorResponse = parsedErrorResponse.error;
                            if (parsedErrorResponse.code) error.code = parsedErrorResponse.code;
                            if (parsedErrorResponse.message) error.message = parsedErrorResponse.message;
                        }
                    } catch (defaultError) {
                        error.message = util.format('Error "%s" occurred in deserializing the responseBody ' +
                            '- "%s" for the default response.', defaultError.message, response.body);
                        return callback(error);
                    }
                    return callback(error);
                }
            });
        });
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
            if (this.client.subscriptionId === null || this.client.subscriptionId === undefined || typeof this.client.subscriptionId.valueOf() !== 'string') {
                throw new Error('this.client.subscriptionId cannot be null or undefined and it must be of type string.');
            }
        } catch (error) {
            return callback(error);
        }

        // Construct URL
        var requestUrl = this.client.baseUri +
            '//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}/powerOff';
        requestUrl = requestUrl.replace('{resourceGroupName}', encodeURIComponent(resourceGroupName));
        requestUrl = requestUrl.replace('{vmName}', encodeURIComponent(vmName));
        requestUrl = requestUrl.replace('{subscriptionId}', encodeURIComponent(this.client.subscriptionId));
        var queryParameters = [];
        queryParameters.push('api-version=' + encodeURIComponent(apiVersion));
        if (queryParameters.length > 0) {
            requestUrl += '?' + queryParameters.join('&');
        }
        // trim all duplicate forward slashes in the url
        var regex = /([^:]\/)\/+/gi;
        requestUrl = requestUrl.replace(regex, '$1');

        // Create object
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.headers = {};
        httpRequest.uri = requestUrl;
        // Set Headers
        if (this.client.generateClientRequestId) {
            httpRequest.headers['x-ms-client-request-id'] = msRestAzure.generateUuid();
        }
        if (this.client.acceptLanguage !== undefined && this.client.acceptLanguage !== null) {
            httpRequest.headers['accept-language'] = this.client.acceptLanguage;
        }
        httpRequest.headers['Content-Type'] = 'application/json; charset=utf-8';
        httpRequest.body = null;
        var serviceClient = new azureServiceClient.ServiceClient(this.client.credentials);
        serviceClient.request(httpRequest).then((response: azureServiceClient.WebResponse) => {
            if (response.error) {
                callback(response.error);
            }
            serviceClient.getLongRunningOperationResult(response).then((operationResponse: azureServiceClient.WebResponse) => {
                if (operationResponse.body.status === "Succeeded") {
                    // Generate Response
                    callback(null);
                } else {
                   var error = new azureServiceClient.Error();
                    error.statusCode = response.statusCode;
                    if (response.body === '') response.body = null;
                    var parsedErrorResponse;
                    try {
                        parsedErrorResponse = response.body;
                        if (parsedErrorResponse) {
                            if (parsedErrorResponse.error) parsedErrorResponse = parsedErrorResponse.error;
                            if (parsedErrorResponse.code) error.code = parsedErrorResponse.code;
                            if (parsedErrorResponse.message) error.message = parsedErrorResponse.message;
                        }
                    } catch (defaultError) {
                        error.message = util.format('Error "%s" occurred in deserializing the responseBody ' +
                            '- "%s" for the default response.', defaultError.message, response.body);
                        return callback(error);
                    }
                    return callback(error);
                }
            });
        });
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
            if (this.client.subscriptionId === null || this.client.subscriptionId === undefined || typeof this.client.subscriptionId.valueOf() !== 'string') {
                throw new Error('this.client.subscriptionId cannot be null or undefined and it must be of type string.');
            }
        } catch (error) {
            return callback(error);
        }

        // Construct URL
        var requestUrl = this.client.baseUri +
            '//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}';
        requestUrl = requestUrl.replace('{resourceGroupName}', encodeURIComponent(resourceGroupName));
        requestUrl = requestUrl.replace('{vmName}', encodeURIComponent(vmName));
        requestUrl = requestUrl.replace('{subscriptionId}', encodeURIComponent(this.client.subscriptionId));
        var queryParameters = [];
        queryParameters.push('api-version=' + encodeURIComponent(apiVersion));
        if (queryParameters.length > 0) {
            requestUrl += '?' + queryParameters.join('&');
        }
        // trim all duplicate forward slashes in the url
        var regex = /([^:]\/)\/+/gi;
        requestUrl = requestUrl.replace(regex, '$1');

        // Create object
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'DELETE';
        httpRequest.headers = {};
        httpRequest.uri = requestUrl;
        // Set Headers
        if (this.client.generateClientRequestId) {
            httpRequest.headers['x-ms-client-request-id'] = msRestAzure.generateUuid();
        }
        if (this.client.acceptLanguage !== undefined && this.client.acceptLanguage !== null) {
            httpRequest.headers['accept-language'] = this.client.acceptLanguage;
        }
        httpRequest.headers['Content-Type'] = 'application/json; charset=utf-8';
        httpRequest.body = null;
        var serviceClient = new azureServiceClient.ServiceClient(this.client.credentials);
        serviceClient.request(httpRequest).then((response: azureServiceClient.WebResponse) => {
            if (response.error) {
                callback(response.error);
            }
            serviceClient.getLongRunningOperationStatus(response).then((operationResponse: azureServiceClient.WebResponse) => {
                if (operationResponse.body.status === "Succeeded") {
                    // Generate Response
                    callback(null);
                } else {
                   var error = new azureServiceClient.Error();
                    error.statusCode = response.statusCode;
                    if (response.body === '') response.body = null;
                    var parsedErrorResponse;
                    try {
                        parsedErrorResponse = response.body;
                        if (parsedErrorResponse) {
                            if (parsedErrorResponse.error) parsedErrorResponse = parsedErrorResponse.error;
                            if (parsedErrorResponse.code) error.code = parsedErrorResponse.code;
                            if (parsedErrorResponse.message) error.message = parsedErrorResponse.message;
                        }
                    } catch (defaultError) {
                        error.message = util.format('Error "%s" occurred in deserializing the responseBody ' +
                            '- "%s" for the default response.', defaultError.message, response.body);
                        return callback(error);
                    }
                    return callback(error);
                }
            });
        });
    }
}

export class VirtualMachineExtensions {
    private client;

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
            '//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}/extensions/{vmExtensionName}';
        requestUrl = requestUrl.replace('{resourceGroupName}', encodeURIComponent(resourceGroupName));
        requestUrl = requestUrl.replace('{vmName}', encodeURIComponent(vmName));
        requestUrl = requestUrl.replace('{vmExtensionName}', encodeURIComponent(vmExtensionName));
        requestUrl = requestUrl.replace('{subscriptionId}', encodeURIComponent(this.client.subscriptionId));
        var queryParameters = [];
        if (expand !== null && expand !== undefined) {
            queryParameters.push('$expand=' + encodeURIComponent(expand));
        }
        queryParameters.push('api-version=' + encodeURIComponent(apiVersion));
        if (queryParameters.length > 0) {
            requestUrl += '?' + queryParameters.join('&');
        }
        // trim all duplicate forward slashes in the url
        var regex = /([^:]\/)\/+/gi;
        requestUrl = requestUrl.replace(regex, '$1');
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
        if (options) {
            for (var headerName in options['customHeaders']) {
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
                        var resultMapper = this.client.models['VirtualMachineExtension'].mapper();
                        result = client.deserialize(resultMapper, parsedResponse, 'result');
                    }
                } catch (error) {
                    var deserializationError = new Error(util.format('Error "%s" occurred in deserializing the responseBody - "%s"', error, responseBody));
                    // deserializationError.request = msRest.stripRequest(httpRequest);
                    // deserializationError.response = msRest.stripResponse(response);
                    return callback(deserializationError);
                }
            }
            console.log("Result: %s", util.inspect(result, { depth: null }));
            return callback(null, result, httpRequest, response);
        });
    }
}