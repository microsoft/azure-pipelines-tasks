import msRestAzure = require("./azure-arm-common");
import webClient = require("./webClient");
import tl = require('vsts-task-lib/task');
import util = require("util");
import azureServiceClient = require("./AzureServiceClient");
import Q = require("q");

export class AzureMysqlManagementClient extends azureServiceClient.ServiceClient {
    public firewallRules: FirewallRules;
    public mysqlServers: MysqlServers;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId, baseUri?: any, options?: any) {
        super(credentials, subscriptionId);

        this.apiVersion = '2017-04-30-preview';
        this.acceptLanguage = 'en-US';
        this.generateClientRequestId = true;

        if (!options) options = {};

        if (baseUri) {
            this.baseUri = baseUri;
        }

        if (options.apiVersion) {
            this.apiVersion = options.apiVersion;
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

        this.firewallRules = new FirewallRules(this);
        this.mysqlServers = new MysqlServers(this);
    }
}

export class FirewallRules {
    private client: AzureMysqlManagementClient;

    constructor(client) {
        this.client = client;
    }
    
    /**
     * Create or update firewall rule for mysql server 
     * @param resourceGroupName     resource group name of mysql server 
     * @param serverName            mysql server name
     * @param firewallRuleName      rule name to be added or updated
     * @param parameters            optional parameter like start and end ip address
     * @param callback              response callback 
     */
    public createOrUpdate(resourceGroupName: string, serverName: string, firewallRuleName: string, parameters, callback?:  azureServiceClient.ApiCallback) {
        var client = this.client;
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        // Validate
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
            if(!this.isNameValid(serverName)){
                throw new Error(tl.loc("ServerNameCannotBeNull"));
            }
            if(!this.isNameValid(firewallRuleName)){
                throw new Error(tl.loc("FirewallRuleNameCannotBeNull"));
            }
        }
        catch (error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.headers = {};
        httpRequest.uri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.DBforMySQL/servers/{serverName}/firewallRules/{firewallRuleName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{serverName}': serverName,
                '{firewallRuleName}': firewallRuleName
            });
            
        if (parameters !== null && parameters !== undefined) {
            httpRequest.body = JSON.stringify(parameters);
        }

        this.client.beginRequest(httpRequest).then(async (response) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            var statusCode = response.statusCode;
            if (statusCode != 200 && statusCode != 201 && statusCode != 202) {
                // Generate Error
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }else {
                this.client.getLongRunningOperationResult(response).then((operationResponse: webClient.WebResponse) => {
                    // Generate Response
                    deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
                }, (error) => deferred.reject(error))
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    /**
     * Delete firewall rule of mysql server
     * @param resourceGroupName     resource group name of mysql server 
     * @param serverName            mysql server name
     * @param firewallRuleName      firewall rule name to be deleted 
     * @param callback              response callback 
     */
    public delete(resourceGroupName: string, serverName: string, firewallRuleName: string, callback?:  azureServiceClient.ApiCallback) {
        var client = this.client;
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        // Validate
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
            if(!this.isNameValid(serverName)){
                throw new Error(tl.loc("ServerNameCannotBeNull"));
            }
            if(!this.isNameValid(firewallRuleName)){
                throw new Error(tl.loc("FirewallRuleNameCannotBeNull"));
            }
        }
        catch (error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'DELETE';
        httpRequest.headers = {};
        httpRequest.uri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.DBforMySQL/servers/{serverName}/firewallRules/{firewallRuleName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{serverName}': serverName,
                '{firewallRuleName}': firewallRuleName
            });

        this.client.beginRequest(httpRequest).then(async (response) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            var statusCode = response.statusCode;
            if (statusCode != 200 && statusCode != 202 && statusCode !=204) {
                // Generate Error
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            else {
                this.client.getLongRunningOperationResult(response).then((operationResponse: webClient.WebResponse) => {
                    // Generate Response
                    deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
                }, (error) => deferred.reject(error))
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    /**
     * Is name valid or not
     */
    private isNameValid(name: string): boolean{
        if (name === null || name === undefined || typeof name.valueOf() !== 'string') {
            return false;
        }else{
            return true;
        }
    }
}

export class  MysqlServers {
    private client: AzureMysqlManagementClient;

    constructor(client) {
        this.client = client;
    }

    /**
     * Get all the mysql server belongs to one subscription
     * @param callback  Response callback
     */
    public list(callback?: azureServiceClient.ApiCallback): void {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        // Create HTTP transport objects
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = {};
        httpRequest.uri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/providers/Microsoft.DBforMySQL/servers',
            {
            }
        );
        // Set body to be null
        httpRequest.body = null;

        //send request
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
                    result.concat(nextResult.result);
                }
                
                return new azureServiceClient.ApiResult(null, result);
            }
            else {
                return new azureServiceClient.ApiResult(azureServiceClient.ToError(response));
            }
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

}