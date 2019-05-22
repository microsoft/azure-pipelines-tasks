import msRestAzure = require("./azure-arm-common");
import webClient = require("./webClient");
import tl = require('azure-pipelines-task-lib/task');
import util = require("util");
import azureServiceClient = require("./AzureServiceClient");
import Q = require("q");
import constants = require('./constants');

export class AzureMysqlManagementClient extends azureServiceClient.ServiceClient {
    public firewallRules: FirewallRules;
    public mysqlServers: MysqlServers;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId, baseUri?: any, options?: any) {
        super(credentials, subscriptionId);

        this.apiVersion = constants.mysqlApiVersion;
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
            if(!this.client.isNameValid(serverName)){
                throw new Error(tl.loc("MysqlServerNameCannotBeEmpty"));
            }
            if(!this.client.isNameValid(firewallRuleName)){
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
            tl.debug("Response for add firewall rule " +statusCode);
            if (statusCode != 200 && statusCode != 201 && statusCode != 202) {
                // Generate Error
                deferred.reject(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            else if(statusCode === 202){
                this._recursiveGetCall(resourceGroupName, serverName, firewallRuleName, 5, 0).then((response) => {
                    deferred.resolve(new azureServiceClient.ApiResult(null, response));
                },(error) => {
                    deferred.reject(error);
                });
            }
            else {
                // Generate Response
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
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
            if(!this.client.isNameValid(serverName)){
                throw new Error(tl.loc("MysqlServerNameCannotBeEmpty"));
            }
            if(!this.client.isNameValid(firewallRuleName)){
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
            tl.debug("Response for delete firewall rule " +statusCode);
            if (statusCode != 200 && statusCode != 202 && statusCode !=204) {
                // Generate Error
                deferred.reject(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            else {
                // Generate Response
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    /**
     * Get firewall rule of mysql server
     * @param resourceGroupName     resource group name of mysql server 
     * @param serverName            mysql server name
     * @param firewallRuleName      firewall rule name to be deleted 
     * @param callback              response callback 
     */
    public get(resourceGroupName: string, serverName: string, firewallRuleName: string, callback?:  azureServiceClient.ApiCallback) {
        var client = this.client;
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        // Validate
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
            if(!this.client.isNameValid(serverName)){
                throw new Error(tl.loc("MysqlServerNameCannotBeEmpty"));
            }
            if(!this.client.isNameValid(firewallRuleName)){
                throw new Error(tl.loc("FirewallRuleNameCannotBeNull"));
            }
        }
        catch (error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = {};
        httpRequest.uri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.DBforMySQL/servers/{serverName}/firewallRules/{firewallRuleName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{serverName}': serverName,
                '{firewallRuleName}': firewallRuleName
            });
        tl.debug("Calling get firewall ");
        this.client.beginRequest(httpRequest).then(async (response) => {
            var deferred = Q.defer<azureServiceClient.ApiResult>();
            var statusCode = response.statusCode;
            tl.debug("Response for get firewall rule " + JSON.stringify(response));
            if (statusCode === 200) {
                // Generate Response
                deferred.resolve(new azureServiceClient.ApiResult(null, response));
            }
            else {
                // Generate exception
                deferred.reject(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }


    /**
     * Retry get call to check firewall rule has added or not
     * @param resourceGroupName     resource group name of mysql server 
     * @param serverName            mysql server name
     * @param firewallRuleName      firewall rule name to be deleted 
     * @param retryOption           no of time to retry
     */
    private _recursiveGetCall(resourceGroupName: string, serverName: string, firewallRuleName: string, retryOption: number, timeToWait: number) : Q.Promise<azureServiceClient.ApiResult>{
        var deferred = Q.defer<azureServiceClient.ApiResult>();
        let waitedTime = 2000 + timeToWait * 2;
        setTimeout(() => {
            this.get(resourceGroupName, serverName, firewallRuleName, (error, result, request, response) => {
                if(error){
                    if(retryOption > 0){
                        deferred.resolve(this._recursiveGetCall(resourceGroupName, serverName, firewallRuleName, retryOption - 1, waitedTime));
                    }else{
                        deferred.reject(new Error(tl.loc("NotAbleToCreateFirewallRule", error)));
                    }
                }
                else{
                    deferred.resolve(new azureServiceClient.ApiResult(null, result));
                }
            });
        }, waitedTime); 

        return deferred.promise;
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
