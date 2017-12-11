import msRestAzure = require("./azure-arm-common");
import tl = require('vsts-task-lib/task');
import util = require("util");
import webClient = require("./webClient");
import azureServiceClient = require("./AzureServiceClient");
import Model = require("./azureModels");
import Q = require("q");

export class AppServiceManagementClient extends azureServiceClient.ServiceClient {
    public appService: AppService;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: string, options?: any) {
        super(credentials, subscriptionId);

        if (!!options && !!options.longRunningOperationRetryTimeout) {
            this.longRunningOperationRetryTimeout = options.longRunningOperationRetryTimeout;
        }

        this.appService = new AppService(this);
    }
}

export class AppService {
    private _client: AppServiceManagementClient;

    constructor(client) {
        this._client = client;
    }

    public async start(resourceGroupName: string, name: string, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        
        if(!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!name || typeof name != 'string') {
                throw new Error(tl.loc('AppNameCannotBeNull'));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/start`,
        {
            '{resourceGroupName}': resourceGroupName,
            '{name}': name,
        }, null, '2016-08-01');

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
        (error) => callback(error));
    }

    public async startSlot(resourceGroupName: string, name: string, slot: string, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        
        if(!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!name || typeof name.valueOf() !== 'string') {
                throw new Error(tl.loc('AppNameCannotBeNull'));
            }

            if(!slot || typeof slot.valueOf() !== 'string') {
                throw new Error(tl.loc('SlotNameCannotBeNull'));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/slots/{slot}/start`,
        {
            '{resourceGroupName}': resourceGroupName,
            '{name}': name,
            '{slot}': slot
        }, null, '2016-08-01');

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
        (error) => callback(error));
    }

    public async stop(resourceGroupName: string, name: string, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        
        if(!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!name || typeof name != 'string') {
                throw new Error(tl.loc('AppNameCannotBeNull'));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/stop`,
        {
            '{resourceGroupName}': resourceGroupName,
            '{name}': name,
        }, null, '2016-08-01');

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
        (error) => callback(error));
    }

    public async stopSlot(resourceGroupName: string, name: string, slot: string, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        
        if(!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!name || typeof name.valueOf() !== 'string') {
                throw new Error(tl.loc('AppNameCannotBeNull'));
            }

            if(!slot || typeof slot.valueOf() !== 'string') {
                throw new Error(tl.loc('SlotNameCannotBeNull'));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/slots/{slot}/stop`,
        {
            '{resourceGroupName}': resourceGroupName,
            '{name}': name,
            '{slot}': slot
        }, null, '2016-08-01');

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
        (error) => callback(error));
    }

    public async restart(resourceGroupName: string, name: string, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        
        if(!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!name || typeof name != 'string') {
                throw new Error(tl.loc('AppNameCannotBeNull'));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        let queryParameters = [];
        let softRestart = (options && options.softRestart !== undefined) ? options.softRestart : undefined;
        let synchronous = (options && options.synchronous !== undefined) ? options.synchronous : undefined;
        if (softRestart !== null && softRestart !== undefined) {
            queryParameters.push('softRestart=' + encodeURIComponent(softRestart.toString()));
        }

        if (synchronous !== null && synchronous !== undefined) {
            queryParameters.push('synchronous=' + encodeURIComponent(synchronous.toString()));
        }

        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/restart`,
        {
            '{resourceGroupName}': resourceGroupName,
            '{name}': name,
        }, queryParameters, '2016-08-01');

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
        (error) => callback(error));
    }

    public async restartSlot(resourceGroupName: string, name: string, slot: string, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        
        if(!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!name || typeof name.valueOf() !== 'string') {
                throw new Error(tl.loc('AppNameCannotBeNull'));
            }

            if(!slot || typeof slot.valueOf() !== 'string') {
                throw new Error(tl.loc('SlotNameCannotBeNull'));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        let queryParameters = [];
        let softRestart = (options && options.softRestart !== undefined) ? options.softRestart : undefined;
        let synchronous = (options && options.synchronous !== undefined) ? options.synchronous : undefined;
        if (softRestart !== null && softRestart !== undefined) {
            queryParameters.push('softRestart=' + encodeURIComponent(softRestart.toString()));
        }

        if (synchronous !== null && synchronous !== undefined) {
            queryParameters.push('synchronous=' + encodeURIComponent(synchronous.toString()));
        }
        
        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/slots/{slot}/restart`,
        {
            '{resourceGroupName}': resourceGroupName,
            '{name}': name,
            '{slot}': slot
        }, queryParameters, '2016-08-01');

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
        (error) => callback(error));
    }

    public swapSlotSlot(resourceGroupName: string, name: string, slotSwapEntity: any, slot: string, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }

        if(!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!name || typeof name.valueOf() != 'string') {
                throw new Error(tl.loc('AppNameCannotBeNull'));
            }

            if(!slot || typeof slot.valueOf() != 'string') {
                throw new Error(tl.loc('SourceSlotNameCannotBeNull'));
            }

            if(!slotSwapEntity) {
                throw new Error(tl.loc('SlotSwapEntityCannotBeNull'));
            }

            if(!slotSwapEntity.targetSlot || typeof slotSwapEntity.targetSlot.valueOf() != 'string' || slotSwapEntity.preserveVnet == null || typeof slotSwapEntity.preserveVnet.valueOf() != 'boolean') {
                throw new Error(tl.loc('InvalidSlotSwapEntity', JSON.stringify(slotSwapEntity)));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{ResourceGroupName}/providers/Microsoft.Web/sites/{name}/slots/{slot}/slotsswap`,
        {
            '{ResourceGroupName}': resourceGroupName,
            '{name}': name,
            '{slot}': slot
        }, null, '2016-08-01');
        httpRequest.headers = this._client.setCustomHeaders(null);
        httpRequest.body = JSON.stringify(slotSwapEntity);
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            var statusCode = response.statusCode;
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else if (response.statusCode != 202) {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            else {
                this._client.getLongRunningOperationResult(response).then((operationResponse: webClient.WebResponse) => {
                    if (operationResponse.statusCode == 200) {
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

    public async swapSlotWithProduction(resourceGroupName: string, name: string, slotSwapEntity: any, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }

        if(!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!name || typeof name.valueOf() != 'string') {
                throw new Error(tl.loc('AppNameCannotBeNull'));
            }

            if(!slotSwapEntity) {
                throw new Error(tl.loc('SlotSwapEntityCannotBeNull'));
            }

            if(!slotSwapEntity.targetSlot || typeof slotSwapEntity.targetSlot.valueOf() != 'string' || slotSwapEntity.preserveVnet == null || typeof slotSwapEntity.preserveVnet.valueOf() != 'boolean') {
                throw new Error(tl.loc('InvalidSlotSwapEntity', JSON.stringify(slotSwapEntity)));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{ResourceGroupName}/providers/Microsoft.Web/sites/{name}/slotsswap`,
        {
            '{ResourceGroupName}': resourceGroupName,
            '{name}': name
        }, null, '2016-08-01');
        httpRequest.headers = this._client.setCustomHeaders(null);
        httpRequest.body = JSON.stringify(slotSwapEntity);
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            var statusCode = response.statusCode;
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else if (response.statusCode != 202) {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            else {
                response.headers['retry-after'] = 10;
                this._client.getLongRunningOperationResult(response).then((operationResponse: webClient.WebResponse) => {
                    if (operationResponse.statusCode == 200) {
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
    
    public async get(resourceGroupName: string, name: string, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }

        if (!callback) {
            throw new Error('callback cannot be null.');    
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!name || typeof name.valueOf() != 'string') {
                throw new Error(tl.loc('AppNameCannotBeNull'));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}`,
        {
            '{resourceGroupName}': resourceGroupName,
            '{name}': name,
        }, null, '2016-08-01');

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
        (error) => callback(error));
    }

    public async getSlot(resourceGroupName: string, name: string, slot: string, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }

        if (!callback) {
            throw new Error('callback cannot be null.');    
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!name || typeof name.valueOf() != 'string') {
                throw new Error(tl.loc('AppNameCannotBeNull'));
            }

            if(!slot || typeof slot.valueOf() !== 'string') {
                throw new Error(tl.loc('SlotNameCannotBeNull'));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/slots/{slot}`,
        {
            '{resourceGroupName}': resourceGroupName,
            '{name}': name,
            '{slot}': slot
        }, null, '2016-08-01');

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
        (error) => callback(error));
    }

    public async listPublishingProfileXmlWithSecrets(resourceGroupName: string, name: string, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }

        if (!callback) {
            throw new Error('callback cannot be null.');    
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!name || typeof name.valueOf() != 'string') {
                throw new Error(tl.loc('AppNameCannotBeNull'));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/publishxml`,
        {
            '{resourceGroupName}': resourceGroupName,
            '{name}': name,
        }, null, '2016-08-01');

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
        (error) => callback(error));
    }

    public async listPublishingProfileXmlWithSecretsSlot(resourceGroupName: string, name: string, slot: string, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }

        if (!callback) {
            throw new Error('callback cannot be null.');    
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!name || typeof name.valueOf() != 'string') {
                throw new Error(tl.loc('AppNameCannotBeNull'));
            }

            if(!slot || typeof slot.valueOf() !== 'string') {
                throw new Error(tl.loc('SlotNameCannotBeNull'));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/slots/{slot}/publishxml`,
        {
            '{resourceGroupName}': resourceGroupName,
            '{name}': name,
            '{slot}': slot
        }, null, '2016-08-01');

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
        (error) => callback(error));
    }

    public async listPublishingCredentials(resourceGroupName: string, name: string, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }

        if (!callback) {
            throw new Error('callback cannot be null.');    
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!name || typeof name.valueOf() != 'string') {
                throw new Error(tl.loc('AppNameCannotBeNull'));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/config/publishingcredentials/list`,
        {
            '{resourceGroupName}': resourceGroupName,
            '{name}': name,
        }, null, '2016-08-01');

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
        (error) => callback(error));
    }

    public async listPublishingCredentialsSlot(resourceGroupName: string, name: string, slot: string, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }

        if (!callback) {
            throw new Error('callback cannot be null.');    
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!name || typeof name.valueOf() != 'string') {
                throw new Error(tl.loc('AppNameCannotBeNull'));
            }

            if(!slot || typeof slot.valueOf() !== 'string') {
                throw new Error(tl.loc('SlotNameCannotBeNull'));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/slots/{slot}/config/publishingcredentials/list`,
        {
            '{resourceGroupName}': resourceGroupName,
            '{name}': name,
            '{slot}': slot
        }, null, '2016-08-01');

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
        (error) => callback(error));
    }

    public async getConfiguration(resourceGroupName: string, name: string, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }

        if (!callback) {
            throw new Error('callback cannot be null.');    
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!name || typeof name.valueOf() != 'string') {
                throw new Error(tl.loc('AppNameCannotBeNull'));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/config/web`,
        {
            '{resourceGroupName}': resourceGroupName,
            '{name}': name,
        }, null, '2016-08-01');

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
        (error) => callback(error));
    }

    public async getConfigurationSlot(resourceGroupName: string, name: string, slot: string, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }

        if (!callback) {
            throw new Error('callback cannot be null.');    
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!name || typeof name.valueOf() != 'string') {
                throw new Error(tl.loc('AppNameCannotBeNull'));
            }

            if(!slot || typeof slot.valueOf() !== 'string') {
                throw new Error(tl.loc('SlotNameCannotBeNull'));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/slots/{slot}/config/web`,
        {
            '{resourceGroupName}': resourceGroupName,
            '{name}': name,
            '{slot}': slot
        }, null, '2016-08-01');

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
        (error) => callback(error));
    }

    public async updateConfiguration(resourceGroupName: string, name: string, siteConfig: any, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }

        if (!callback) {
            throw new Error('callback cannot be null.');    
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!name || typeof name.valueOf() != 'string') {
                throw new Error(tl.loc('AppNameCannotBeNull'));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.body = JSON.stringify(siteConfig);
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/config/web`,
        {
            '{resourceGroupName}': resourceGroupName,
            '{name}': name,
        }, null, '2016-08-01');

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
        (error) => callback(error));
    }

    public async updateConfigurationSlot(resourceGroupName: string, name: string, siteConfig: any, slot: string, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }

        if (!callback) {
            throw new Error('callback cannot be null.');    
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!name || typeof name.valueOf() != 'string') {
                throw new Error(tl.loc('AppNameCannotBeNull'));
            }

            if(!slot || typeof slot.valueOf() !== 'string') {
                throw new Error(tl.loc('SlotNameCannotBeNull'));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.body = JSON.stringify(siteConfig);
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/slots/{slot}/config/web`,
        {
            '{resourceGroupName}': resourceGroupName,
            '{name}': name,
            '{slot}': slot
        }, null, '2016-08-01');

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
        (error) => callback(error));
    }

    public async getApplicationSettings(resourceGroupName: string, name: string, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }

        if (!callback) {
            throw new Error('callback cannot be null.');    
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!name || typeof name.valueOf() != 'string') {
                throw new Error(tl.loc('AppNameCannotBeNull'));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/config/appsettings/list`,
        {
            '{resourceGroupName}': resourceGroupName,
            '{name}': name,
        }, null, '2016-08-01');

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
        (error) => callback(error));
    }

    public async getApplicationSettingsSlot(resourceGroupName: string, name: string, slot: string, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }

        if (!callback) {
            throw new Error('callback cannot be null.');    
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!name || typeof name.valueOf() != 'string') {
                throw new Error(tl.loc('AppNameCannotBeNull'));
            }

            if(!slot || typeof slot.valueOf() !== 'string') {
                throw new Error(tl.loc('SlotNameCannotBeNull'));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/slots/{slot}/config/appsettings/list`,
        {
            '{resourceGroupName}': resourceGroupName,
            '{name}': name,
            '{slot}': slot
        }, null, '2016-08-01');

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
        (error) => callback(error));
    }

    public async updateApplicationSettings(resourceGroupName: string, name: string, appSettings: any, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }

        if (!callback) {
            throw new Error('callback cannot be null.');    
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!name || typeof name.valueOf() != 'string') {
                throw new Error(tl.loc('AppNameCannotBeNull'));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.body = JSON.stringify(appSettings);
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/config/appsettings`,
        {
            '{resourceGroupName}': resourceGroupName,
            '{name}': name,
        }, null, '2016-08-01');

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
        (error) => callback(error));
    }

    public async updateApplicationSettingsSlot(resourceGroupName: string, name: string, appSettings: any, slot: string, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }

        if (!callback) {
            throw new Error('callback cannot be null.');    
        }

        try {
            this._client.isValidResourceGroupName(resourceGroupName);
            if(!name || typeof name.valueOf() != 'string') {
                throw new Error(tl.loc('AppNameCannotBeNull'));
            }

            if(!slot || typeof slot.valueOf() !== 'string') {
                throw new Error(tl.loc('SlotNameCannotBeNull'));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.body = JSON.stringify(appSettings);
        if(options) {
            httpRequest.headers = this._client.setCustomHeaders(options);
        }

        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/slots/{slot}/config/appsettings`,
        {
            '{resourceGroupName}': resourceGroupName,
            '{name}': name,
            '{slot}': slot
        }, null, '2016-08-01');

        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
        (error) => callback(error));
    }
}