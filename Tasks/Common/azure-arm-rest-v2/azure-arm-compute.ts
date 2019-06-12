import msRestAzure = require("./azure-arm-common");
import tl = require('azure-pipelines-task-lib/task');
import util = require("util");
import webClient = require("./webClient");
import azureServiceClient = require("./AzureServiceClient");
import Model = require("./azureModels");
import Q = require("q");

export class ComputeManagementClient extends azureServiceClient.ServiceClient {

    public virtualMachines: VirtualMachines;
    public virtualMachineExtensions: VirtualMachineExtensions;
    public virtualMachineScaleSets: VirtualMachineScaleSets;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId, baseUri?: any, options?: any) {
        super(credentials, subscriptionId);

        this.acceptLanguage = 'en-US';
        this.generateClientRequestId = true;
        this.apiVersion = (credentials.isAzureStackEnvironment) ? '2015-06-15' : '2016-03-30';

        if (!options)
            options = {};

        if (baseUri) {
            this.baseUri = baseUri;
        }

        if (options.acceptLanguage) {
            this.acceptLanguage = options.acceptLanguage;
        }
        if (options.longRunningOperationRetryTimeout) {
            this.longRunningOperationRetryTimeout = options.longRunningOperationRetryTimeout;
        }
        if (options.generateClientRequestId) {
            this.generateClientRequestId = options.generateClientRequestId;
        }
        this.virtualMachines = new VirtualMachines(this);
        this.virtualMachineExtensions = new VirtualMachineExtensions(this);
        this.virtualMachineScaleSets = new VirtualMachineScaleSets(this);
    }
}

export class VirtualMachines {
    private client: ComputeManagementClient;

    constructor(client) {
        this.client = client;
    }

    public list(resourceGroupName, options, callback: azureServiceClient.ApiCallback) {
        if (!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
        }
        catch (error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = this.client.setCustomHeaders(options);
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines',
            {
                '{resourceGroupName}': resourceGroupName
            }
        );

        var result = [];
        this.client.beginRequest(httpRequest).then(async (response: webClient.WebResponse) => {
            if (response.statusCode == 200) {
                if (response.body.value) {
                    result = result.concat(response.body.value);
                }

                if (response.body.nextLink) {
                    var nextResult = await this.client.accumulateResultFromPagedResult(response.body.nextLink);
                    if (nextResult.error) {
                        return new azureServiceClient.ApiResult(nextResult.error);
                    }
                    result = result.concat(nextResult.result);
                }
                return new azureServiceClient.ApiResult(null, result);
            }
            else {
                return new azureServiceClient.ApiResult(azureServiceClient.ToError(response));
            }
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public get(resourceGroupName, vmName, options, callback: azureServiceClient.ApiCallback) {
        var client = this.client;
        if (!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        var expand = (options && options.expand !== undefined) ? options.expand : undefined;
        // Validate
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
            if (vmName === null || vmName === undefined || typeof vmName.valueOf() !== 'string') {
                throw new Error(tl.loc("VMNameCannotBeNull"));
            }
            if (expand) {
                var allowedValues = ['instanceView'];
                if (!allowedValues.some(function (item) { return item === expand; })) {
                    throw new Error(tl.loc("InvalidValue", expand, allowedValues));
                }
            }
        } catch (error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{vmName}': vmName
            },
            ['$expand=' + encodeURIComponent(expand)]
        );
        // Set Headers
        httpRequest.headers = this.client.setCustomHeaders(options);

        this.client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            if (response.statusCode == 200) {
                var result = response.body;
                deferred.resolve(new azureServiceClient.ApiResult(null, result));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public restart(resourceGroupName: string, vmName: string, callback: azureServiceClient.ApiCallback) {
        var client = this.client;
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
            if (vmName === null || vmName === undefined || typeof vmName.valueOf() !== 'string') {
                throw new Error(tl.loc("VMNameCannotBeNull"));
            }
        } catch (error) {
            return callback(error);
        }

        // Create object
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}/restart',
            {
                '{resourceGroupName}': resourceGroupName,
                '{vmName}': vmName
            }
        );
        // Set Headers
        httpRequest.headers = this.client.setCustomHeaders(null);
        httpRequest.body = null;

        this.client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            if (response.statusCode != 202) {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            else {
                this.client.getLongRunningOperationResult(response).then((operationResponse: webClient.WebResponse) => {
                    if (operationResponse.body.status == "Succeeded") {
                        deferred.resolve(new azureServiceClient.ApiResult(null, operationResponse.body));
                    }
                    else {
                        deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(operationResponse)));
                    }
                }, (error) => deferred.reject(error));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public start(resourceGroupName: string, vmName: string, callback: azureServiceClient.ApiCallback) {
        var client = this.client;
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
            if (vmName === null || vmName === undefined || typeof vmName.valueOf() !== 'string') {
                throw new Error(tl.loc("VMNameCannotBeNull"));
            }
        } catch (error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}/start',
            {
                '{resourceGroupName}': resourceGroupName,
                '{vmName}': vmName
            });
        httpRequest.headers = this.client.setCustomHeaders(null);
        httpRequest.body = null;

        this.client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            var statusCode = response.statusCode;
            if (statusCode != 202) {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            else {
                this.client.getLongRunningOperationResult(response).then((operationResponse: webClient.WebResponse) => {
                    if (operationResponse.body.status == "Succeeded") {
                        deferred.resolve(new azureServiceClient.ApiResult(null, operationResponse.body));
                    }
                    else {
                        deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(operationResponse)));
                    }
                }, (error) => deferred.reject(error));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public powerOff(resourceGroupName: string, vmName: string, callback: azureServiceClient.ApiCallback) {
        var client = this.client;
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
            if (vmName === null || vmName === undefined || typeof vmName.valueOf() !== 'string') {
                throw new Error(tl.loc("VMNameCannotBeNull"));
            }
        } catch (error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.headers = this.client.setCustomHeaders(null);
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}/powerOff',
            {
                '{resourceGroupName}': resourceGroupName,
                '{vmName}': vmName
            }
        );
        this.client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            var statusCode = response.statusCode;
            if (statusCode != 202) {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            else {
                this.client.getLongRunningOperationResult(response).then((operationResponse: webClient.WebResponse) => {
                    if (operationResponse.body.status == "Succeeded") {
                        deferred.resolve(new azureServiceClient.ApiResult(null, operationResponse.body));
                    }
                    else {
                        deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(operationResponse)));
                    }
                }, (error) => deferred.reject(error));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public deallocate(resourceGroupName: string, vmName: string, callback: azureServiceClient.ApiCallback) {
        var client = this.client;
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
            if (vmName === null || vmName === undefined || typeof vmName.valueOf() !== 'string') {
                throw new Error(tl.loc("VMNameCannotBeNull"));
            }
        } catch (error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.headers = this.client.setCustomHeaders(null);
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}/deallocate',
            {
                '{resourceGroupName}': resourceGroupName,
                '{vmName}': vmName
            }
        );
        this.client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            var statusCode = response.statusCode;
            if (statusCode != 202) {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            else {
                this.client.getLongRunningOperationResult(response).then((operationResponse: webClient.WebResponse) => {
                    if (operationResponse.body.status == "Succeeded") {
                        deferred.resolve(new azureServiceClient.ApiResult(null, operationResponse.body));
                    }
                    else {
                        deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(operationResponse)));
                    }
                }, (error) => deferred.reject(error));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public deleteMethod(resourceGroupName: string, vmName: string, callback: azureServiceClient.ApiCallback) {
        var client = this.client;
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
            if (vmName === null || vmName === undefined || typeof vmName.valueOf() !== 'string') {
                throw new Error(tl.loc("VMNameCannotBeNull"));
            }
        } catch (error) {
            return callback(error);
        }

        // Create object
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'DELETE';
        httpRequest.headers = this.client.setCustomHeaders(null);
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{vmName}': vmName
            }
        );
        httpRequest.body = null;
        this.client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            var statusCode = response.statusCode;
            if (statusCode != 202 && statusCode != 204) {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            else {
                this.client.getLongRunningOperationResult(response).then((operationResponse: webClient.WebResponse) => {
                    if (operationResponse.body.status === "Succeeded") {
                        // Generate Response
                        deferred.resolve(new azureServiceClient.ApiResult(null, operationResponse.body));
                    } else {
                        deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(operationResponse)));
                    }
                }, (error) => deferred.reject(error));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }
}

export class VirtualMachineExtensions {
    private client: ComputeManagementClient;

    constructor(client: ComputeManagementClient) {
        this.client = client;
    }

    public list(resourceGroupName: string, resourceName: string, resourceType: Model.ComputeResourceType, options, callback: azureServiceClient.ApiCallback) {
        if (!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        // Validate
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
            if (resourceName === null || resourceName === undefined || typeof resourceName.valueOf() !== 'string') {
                throw new Error(tl.loc("ResourceNameCannotBeNull"));
            }
        } catch (error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = this.client.setCustomHeaders(options);
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/{resourceType}/{resourceName}/extensions',
            {
                '{resourceGroupName}': resourceGroupName,
                '{resourceType}': getComputeResourceTypeString(resourceType),
                '{resourceName}': resourceName
            }
        );

        var result = [];
        this.client.beginRequest(httpRequest).then(async (response: webClient.WebResponse) => {
            if (response.statusCode == 200) {
                if (response.body.value) {
                    result = result.concat(response.body.value);
                }

                if (response.body.nextLink) {
                    var nextResult = await this.client.accumulateResultFromPagedResult(response.body.nextLink);
                    if (nextResult.error) {
                        return new azureServiceClient.ApiResult(nextResult.error);
                    }
                    result = result.concat(nextResult.result);
                }
                return new azureServiceClient.ApiResult(null, result);
            }
            else {
                return new azureServiceClient.ApiResult(azureServiceClient.ToError(response), result);
            }
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public get(resourceGroupName: string, resourceName: string, resourceType: Model.ComputeResourceType, vmExtensionName: string, options, callback: azureServiceClient.ApiCallback) {
        var client = this.client;
        if (!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        var expand = (options && options.expand !== undefined) ? options.expand : undefined;
        // Validate
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
            if (resourceName === null || resourceName === undefined || typeof resourceName.valueOf() !== 'string') {
                throw new Error(tl.loc("ResourceNameCannotBeNull"));
            }
            if (vmExtensionName === null || vmExtensionName === undefined || typeof vmExtensionName.valueOf() !== 'string') {
                throw new Error(tl.loc("VmExtensionNameCannotBeNull"));
            }
            if (expand !== null && expand !== undefined && typeof expand.valueOf() !== 'string') {
                throw new Error(tl.loc("ExpandShouldBeOfTypeString"));
            }
        } catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = this.client.setCustomHeaders(options);
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/{resourceType}/{resourceName}/extensions/{vmExtensionName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{resourceType}': getComputeResourceTypeString(resourceType),
                '{resourceName}': resourceName,
                '{vmExtensionName}': vmExtensionName
            }
        );
        httpRequest.body = null;

        this.client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            if (response.statusCode == 200) {
                var result = response.body;
                deferred.resolve(new azureServiceClient.ApiResult(null, result));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public createOrUpdate(resourceGroupName: string, resourceName: string, resourceType: Model.ComputeResourceType, vmExtensionName: string, extensionParameters, callback: azureServiceClient.ApiCallback): void {
        var client = this.client;

        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
            if (resourceName === null || resourceName === undefined || typeof resourceName.valueOf() !== 'string') {
                throw new Error(tl.loc("ResourceNameCannotBeNull"));
            }
            if (vmExtensionName === null || vmExtensionName === undefined || typeof vmExtensionName.valueOf() !== 'string') {
                throw new Error(tl.loc("VmExtensionNameCannotBeNull"));
            }
            if (extensionParameters === null || extensionParameters === undefined) {
                throw new Error(tl.loc("ExtensionParametersCannotBeNull"));
            }
        } catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.headers = this.client.setCustomHeaders(null);
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/{resourceType}/{resourceName}/extensions/{vmExtensionName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{resourceType}': getComputeResourceTypeString(resourceType),
                '{resourceName}': resourceName,
                '{vmExtensionName}': vmExtensionName
            }
        );

        // Serialize Request
        var requestContent = null;
        var requestModel = null;
        if (extensionParameters !== null && extensionParameters !== undefined) {
            httpRequest.body = JSON.stringify(extensionParameters);
        }

        // Send request
        this.client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            if (response.statusCode != 200 && response.statusCode != 201) {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            else {
                this.client.getLongRunningOperationResult(response).then((operationResponse: webClient.WebResponse) => {
                    if (operationResponse.body.status === "Succeeded") {
                        var result = { properties: { "provisioningState": operationResponse.body.status } };
                        deferred.resolve(new azureServiceClient.ApiResult(null, result));
                    } else {
                        deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(operationResponse)));
                    }
                }, (error) => deferred.reject(error));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));

    }

    public deleteMethod(resourceGroupName: string, resourceName: string, resourceType: Model.ComputeResourceType, vmExtensionName: string, callback: azureServiceClient.ApiCallback) {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        // Validate
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
            if (resourceName === null || resourceName === undefined || typeof resourceName.valueOf() !== 'string') {
                throw new Error(tl.loc("ResourceNameCannotBeNull"));
            }
            if (vmExtensionName === null || vmExtensionName === undefined || typeof vmExtensionName.valueOf() !== 'string') {
                throw new Error(tl.loc("VmExtensionNameCannotBeNull"));
            }
        } catch (error) {
            return callback(error);
        }

        // Create HTTP transport objects
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'DELETE';
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/{resourceType}/{resourceName}/extensions/{vmExtensionName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{resourceType}': getComputeResourceTypeString(resourceType),
                '{resourceName}': resourceName,
                '{vmExtensionName}': vmExtensionName
            }
        );

        // Send request
        this.client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            if (response.statusCode !== 202 && response.statusCode !== 204) {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            else {
                this.client.getLongRunningOperationResult(response).then((operationResponse: webClient.WebResponse) => {
                    if (operationResponse.statusCode === 200) {
                        deferred.resolve(new azureServiceClient.ApiResult(null));
                    } else {
                        deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(operationResponse)));
                    }
                }, (error) => deferred.reject(error));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

}

export class VirtualMachineScaleSets {
    private client: ComputeManagementClient;

    constructor(client) {
        this.client = client;
    }

    public list(options, callback: azureServiceClient.ApiCallback) {
        if (!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = this.client.setCustomHeaders(options);
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/providers/Microsoft.Compute/virtualMachineScaleSets', {});

        var result = [];
        this.client.beginRequest(httpRequest).then(async (response: webClient.WebResponse) => {
            if (response.statusCode == 200) {
                if (response.body.value) {
                    result = result.concat(response.body.value);
                }

                if (response.body.nextLink) {
                    var nextResult = await this.client.accumulateResultFromPagedResult(response.body.nextLink);
                    if (nextResult.error) {
                        return new azureServiceClient.ApiResult(nextResult.error);
                    }
                    result = result.concat(nextResult.result);
                }
                return new azureServiceClient.ApiResult(null, result);
            }
            else {
                return new azureServiceClient.ApiResult(azureServiceClient.ToError(response), result);
            }
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public get(resourceGroupName: string, vmssName: string, options, callback: azureServiceClient.ApiCallback) {
        var client = this.client;
        if (!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        var expand = (options && options.expand !== undefined) ? options.expand : undefined;

        // Validate
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
            if (vmssName === null || vmssName === undefined || typeof vmssName.valueOf() !== 'string') {
                throw new Error(tl.loc("VMSSNameCannotBeNull"));
            }
            if (expand) {
                var allowedValues = ['instanceView'];
                if (!allowedValues.some(function (item) { return item === expand; })) {
                    throw new Error(tl.loc("InvalidValue", expand, allowedValues));
                }
            }
        } catch (error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachineScaleSets/{vmssName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{vmssName}': vmssName
            },
            ['$expand=' + encodeURIComponent(expand)]
        );

        // Set Headers
        httpRequest.headers = this.client.setCustomHeaders(options);

        this.client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            if (response.statusCode == 200) {
                var result = response.body;
                deferred.resolve(new azureServiceClient.ApiResult(null, result));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public updateImage(resourceGroupName: string, vmssName: string, imageUrl: string, options, callback: azureServiceClient.ApiCallback) {
        var client = this.client;
        if (!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        if (imageUrl === null || imageUrl === undefined || typeof imageUrl.valueOf() !== 'string') {
            throw new Error(tl.loc("VMSSImageUrlCannotBeNull"));
        }

        var expand = (options && options.expand !== undefined) ? options.expand : undefined;

        // Validate
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
            if (vmssName === null || vmssName === undefined || typeof vmssName.valueOf() !== 'string') {
                throw new Error(tl.loc("VMSSNameCannotBeNull"));
            }
        } catch (error) {
            return callback(error);
        }

        // get VMSS
        this.get(resourceGroupName, vmssName, null, (error, result, request, response) => {
            if (error) {
                tl.warning(tl.loc("GetVMSSFailed", resourceGroupName, vmssName, error));
                return callback(error, null);
            }

            var vmss: Model.VMSS = result;
            var osDisk = vmss.properties.virtualMachineProfile.storageProfile.osDisk;
            if (!(osDisk && osDisk.image && osDisk.image.uri)) {
                return callback(tl.loc("VMSSDoesNotHaveCustomImage", vmssName));
            }

            if (imageUrl === osDisk.image.uri) {
                console.log(tl.loc("VMSSImageAlreadyUptoDate", vmssName));
                return callback(null, null);
            }

            // update image uri
            osDisk.image.uri = imageUrl;
            var storageProfile: Model.StorageProfile = { "osDisk": osDisk };

            // update VM extension
            var oldExtensionProfile: Model.ExtensionProfile = vmss.properties.virtualMachineProfile.extensionProfile;
            var virtualMachineProfile: Model.VirtualMachineProfile = { "storageProfile": storageProfile };
            var properties: Model.VMSSProperties = { "virtualMachineProfile": virtualMachineProfile };
            var patchBody: Model.VMSS = {
                "id": vmss["id"],
                "name": vmss["name"],
                "properties": properties
            };

            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'PATCH';
            httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachineScaleSets/{vmssName}',
                {
                    '{resourceGroupName}': resourceGroupName,
                    '{vmssName}': vmssName
                }
            );

            // Set Headers
            httpRequest.headers = this.client.setCustomHeaders(options);
            httpRequest.body = JSON.stringify(patchBody);

            // patch VMSS image
            console.log(tl.loc("NewVMSSImageUrl", imageUrl));
            console.log(tl.loc("VMSSUpdateImage", vmssName));
            this.client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
                var deferred = Q.defer<azureServiceClient.ApiResult>();
                var statusCode = response.statusCode;
                if (response.statusCode == 200) {
                    // wait for image update to complete
                    this.client.getLongRunningOperationResult(response).then((operationResponse: webClient.WebResponse) => {
                        if (operationResponse.body.status === "Succeeded") {
                            deferred.resolve(new azureServiceClient.ApiResult(null, operationResponse.body));
                        }
                        else {
                            deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(operationResponse)));
                        }
                    }, (error) => deferred.reject(error));
                }
                else {
                    deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
                }
                return deferred.promise;
            }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
                (error) => callback(error));
        });
    }
}

export function getComputeResourceTypeString(resourceType: Model.ComputeResourceType): string {
    switch (resourceType) {
        case Model.ComputeResourceType.VirtualMachine:
            return "virtualMachines"
        case Model.ComputeResourceType.VirtualMachineScaleSet:
            return "virtualMachineScaleSets"
    }
}