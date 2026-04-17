import tl = require('azure-pipelines-task-lib/task');
import Q = require('q');
import { ServiceClient } from 'azure-pipelines-tasks-azure-arm-rest/AzureServiceClient';
import { ToError, ApiResult, ApiCallback } from 'azure-pipelines-tasks-azure-arm-rest/AzureServiceClientBase';
import { WebRequest } from 'azure-pipelines-tasks-azure-arm-rest/webClient';
import { ApplicationTokenCredentials } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-common';

const flexibleServerApiVersion = '2021-12-01-preview';

export class AzureMysqlFlexibleServerManagementClient extends ServiceClient {
    public firewallRules: FlexibleServerFirewallRules;
    public mysqlServers: FlexibleMysqlServers;

    constructor(credentials: ApplicationTokenCredentials, subscriptionId: string, baseUri?: string, options?: any) {
        super(credentials, subscriptionId);
        this.apiVersion = flexibleServerApiVersion;
        this.acceptLanguage = 'en-US';
        this.generateClientRequestId = true;

        if (options) {
            if (options.acceptLanguage) {
                this.acceptLanguage = options.acceptLanguage;
            }
            if (options.longRunningOperationRetryTimeout) {
                this.longRunningOperationRetryTimeout = options.longRunningOperationRetryTimeout;
            }
            if (options.generateClientRequestId) {
                this.generateClientRequestId = options.generateClientRequestId;
            }
        }
        if (baseUri) {
            this.baseUri = baseUri;
        }

        this.firewallRules = new FlexibleServerFirewallRules(this);
        this.mysqlServers = new FlexibleMysqlServers(this);
    }
}

export class FlexibleServerFirewallRules {
    private client: AzureMysqlFlexibleServerManagementClient;

    constructor(client: AzureMysqlFlexibleServerManagementClient) {
        this.client = client;
    }

    public createOrUpdate(resourceGroupName: string, serverName: string, firewallRuleName: string, parameters: any, callback: ApiCallback): void {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
            if (!this.client.isNameValid(serverName)) {
                throw new Error(tl.loc("MysqlServerNameCannotBeEmpty"));
            }
            if (!this.client.isNameValid(firewallRuleName)) {
                throw new Error(tl.loc("FirewallRuleNameCannotBeNull"));
            }
        } catch (error) {
            return callback(error);
        }

        var httpRequest = new WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.headers = {};
        httpRequest.uri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.DBforMySQL/flexibleServers/{serverName}/firewallRules/{firewallRuleName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{serverName}': serverName,
                '{firewallRuleName}': firewallRuleName
            }
        );

        if (parameters !== null && parameters !== undefined) {
            httpRequest.body = JSON.stringify(parameters);
        }

        this.client.beginRequest(httpRequest).then(async (response) => {
            var deferred = Q.defer<ApiResult>();
            var statusCode = response.statusCode;
            tl.debug("Response for add firewall rule " + statusCode);
            if (statusCode != 200 && statusCode != 201 && statusCode != 202) {
                deferred.reject(new ApiResult(ToError(response)));
            } else if (statusCode === 202) {
                this._recursiveGetCall(resourceGroupName, serverName, firewallRuleName, 5, 1).then((response) => {
                    deferred.resolve(new ApiResult(null, response));
                }, (error) => {
                    deferred.reject(error);
                });
            } else {
                deferred.resolve(new ApiResult(null, response.body));
            }
            return deferred.promise;
        }).then((apiResult: ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public delete(resourceGroupName: string, serverName: string, firewallRuleName: string, callback: ApiCallback): void {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
            if (!this.client.isNameValid(serverName)) {
                throw new Error(tl.loc("MysqlServerNameCannotBeEmpty"));
            }
            if (!this.client.isNameValid(firewallRuleName)) {
                throw new Error(tl.loc("FirewallRuleNameCannotBeNull"));
            }
        } catch (error) {
            return callback(error);
        }

        var httpRequest = new WebRequest();
        httpRequest.method = 'DELETE';
        httpRequest.headers = {};
        httpRequest.uri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.DBforMySQL/flexibleServers/{serverName}/firewallRules/{firewallRuleName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{serverName}': serverName,
                '{firewallRuleName}': firewallRuleName
            }
        );

        this.client.beginRequest(httpRequest).then(async (response) => {
            var deferred = Q.defer<ApiResult>();
            var statusCode = response.statusCode;
            tl.debug("Response for delete firewall rule " + statusCode);
            if (statusCode != 200 && statusCode != 202 && statusCode != 204) {
                deferred.reject(new ApiResult(ToError(response)));
            } else if (statusCode === 202) {
                this._recursiveGetCall(resourceGroupName, serverName, firewallRuleName, 3, 1).then(() => {
                    deferred.resolve(new ApiResult(null, response.body));
                }, () => {
                    // Firewall rule may already be deleted; resolve anyway
                    deferred.resolve(new ApiResult(null, response.body));
                });
            } else {
                deferred.resolve(new ApiResult(null, response.body));
            }
            return deferred.promise;
        }).then((apiResult: ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public get(resourceGroupName: string, serverName: string, firewallRuleName: string, callback: ApiCallback): void {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }
        try {
            this.client.isValidResourceGroupName(resourceGroupName);
            if (!this.client.isNameValid(serverName)) {
                throw new Error(tl.loc("MysqlServerNameCannotBeEmpty"));
            }
            if (!this.client.isNameValid(firewallRuleName)) {
                throw new Error(tl.loc("FirewallRuleNameCannotBeNull"));
            }
        } catch (error) {
            return callback(error);
        }

        var httpRequest = new WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = {};
        httpRequest.uri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.DBforMySQL/flexibleServers/{serverName}/firewallRules/{firewallRuleName}',
            {
                '{resourceGroupName}': resourceGroupName,
                '{serverName}': serverName,
                '{firewallRuleName}': firewallRuleName
            }
        );

        tl.debug("Calling get firewall");
        this.client.beginRequest(httpRequest).then(async (response) => {
            var deferred = Q.defer<ApiResult>();
            var statusCode = response.statusCode;
            tl.debug("Response for get firewall rule " + JSON.stringify(response));
            if (statusCode === 200) {
                deferred.resolve(new ApiResult(null, response));
            } else {
                deferred.reject(new ApiResult(ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    private _recursiveGetCall(resourceGroupName: string, serverName: string, firewallRuleName: string, retryOption: number, retryAttempt: number): Q.Promise<any> {
        var deferred = Q.defer<any>();
        let waitedTime = 2000 * Math.pow(2, retryAttempt);
        setTimeout(() => {
            this.get(resourceGroupName, serverName, firewallRuleName, (error, result, request, response) => {
                if (error) {
                    if (retryOption > 0) {
                        deferred.resolve(this._recursiveGetCall(resourceGroupName, serverName, firewallRuleName, retryOption - 1, retryAttempt + 1));
                    } else {
                        deferred.reject(new Error(tl.loc("NotAbleToCreateFirewallRule", error)));
                    }
                } else {
                    deferred.resolve(new ApiResult(null, result));
                }
            });
        }, waitedTime);
        return deferred.promise;
    }
}

export class FlexibleMysqlServers {
    private client: AzureMysqlFlexibleServerManagementClient;

    constructor(client: AzureMysqlFlexibleServerManagementClient) {
        this.client = client;
    }

    public list(callback: ApiCallback): void {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        var httpRequest = new WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = {};
        httpRequest.uri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/providers/Microsoft.DBforMySQL/flexibleServers',
            {}
        );
        httpRequest.body = null;

        var result = [];
        this.client.beginRequest(httpRequest).then(async (response) => {
            if (response.statusCode == 200) {
                if (response.body.value) {
                    result = result.concat(response.body.value);
                }
                if (response.body.nextLink) {
                    var nextResult = await this.client.accumulateResultFromPagedResult(response.body.nextLink);
                    if (nextResult.error) {
                        return new ApiResult(nextResult.error);
                    }
                    result = result.concat(nextResult.result);
                }
                return new ApiResult(null, result);
            } else {
                return new ApiResult(ToError(response));
            }
        }).then((apiResult: ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }
}
