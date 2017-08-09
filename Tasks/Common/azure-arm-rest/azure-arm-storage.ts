import msRestAzure = require("./azure-arm-common");
import azureServiceClient = require("./AzureServiceClient");
import Model = require("./azureModels");
import webClient = require("./webClient");
import tl = require('vsts-task-lib/task');
import Q = require('q');
import util = require("util");

export class StorageManagementClient extends azureServiceClient.ServiceClient {
    public storageAccounts: StorageAccounts;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: string, baseUri?: any, options?: any) {
        super(credentials, subscriptionId);

        this.acceptLanguage = 'en-US';
        this.generateClientRequestId = true;
        this.apiVersion = (credentials.isAzureStackEnvironment) ? '2015-06-15' : '2017-06-01';

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
        this.storageAccounts = new StorageAccounts(this);
    }
}

export class StorageAccounts {
    private client: StorageManagementClient;

    constructor(client) {
        this.client = client;
    }

    public async list(options): Promise<Model.StorageAccount[]> {
       var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = this.client.setCustomHeaders(options);
        // Getting all storage accounts (along with resource group names) for the given subscription.
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/providers/Microsoft.Storage/storageAccounts', {});

        var deferred = Q.defer<Model.StorageAccount[]>();
        var result = [];
        this.client.beginRequest(httpRequest).then(async function(response) {
            if (response.statusCode == 200) {
                if (response.body.value) {
                    let storageAccounts: Model.StorageAccount[] = response.body.value;
                    result = result.concat(storageAccounts);
                }

                if (response.body.nextLink) {
                    var nextResult = await this.accumulateResultFromPagedResult(response.body.nextLink);
                    if (nextResult.error) {
                        deferred.reject(nextResult.error);
                    }

                    let storageAccounts: Model.StorageAccount[] = nextResult.result;
                    result = result.concat(storageAccounts);
                }

                deferred.resolve(result);
            }
            else {
                deferred.reject(azureServiceClient.ToError(response));
            }
        }).catch(function(error) {
            deferred.reject(error);
        });

        return deferred.promise;
    }

    public async listKeys(resourceGroupName: string, accountName: string, options): Promise<string[]> {
        if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
          throw new Error(tl.loc("ResourceGroupCannotBeNull"));
        }

        if (accountName === null || accountName === undefined || typeof accountName.valueOf() !== 'string') {
          throw new Error(tl.loc("StorageAccountCannotBeNull"));
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.headers = this.client.setCustomHeaders(options);
        httpRequest.uri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/providers/Microsoft.Storage/storageAccounts/{storageAccountName}/listKeys',
            {
                '{resourceGroupName}': resourceGroupName,
                '{storageAccountName}': accountName
            }
        );
        var deferred = Q.defer<string[]>();
        var accessKeys: string[] = [];
        this.client.beginRequest(httpRequest).then(function(response) {
            if (response.statusCode == 200) {
                if (response.body.keys) {
                    let keys = response.body.keys;
                    for(let i = 0; i<keys.length; i++) {
                        accessKeys[i] = keys[i]["value"];
                    }
                }

                deferred.resolve(accessKeys);
            } else {
                deferred.reject(azureServiceClient.ToError(response));
            }
        }).catch(function(error) {
            deferred.reject(error);
        });

        return deferred.promise;
    }

    public static getResourceGroupNameFromUri(resourceUri: string): string {
        if (this.isNonEmptyInternal(resourceUri)) {
            resourceUri = resourceUri.toLowerCase();
            return resourceUri.substring(resourceUri.indexOf("resourcegroups/") + "resourcegroups/".length, resourceUri.indexOf("/providers"));
        }
        return "";
    }

    private static isNonEmptyInternal(str: string): boolean {
        return (!!str && !!str.trim());
    }
}