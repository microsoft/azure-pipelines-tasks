import msRestAzure = require("./azure-arm-common");
import azureServiceClient = require("./AzureServiceClient");
import Model = require("./azureModels");
import webClient = require("./webClient");
import tl = require('azure-pipelines-task-lib/task');
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
        // Getting all azure rm storage accounts (along with resource group names) for the given subscription.
        httpRequest.uri = this.client.getRequestUri('//subscriptions/{subscriptionId}/providers/Microsoft.Storage/storageAccounts', {});

        var deferred = Q.defer<Model.StorageAccount[]>();
        var result = [];
        this.client.beginRequest(httpRequest).then(async (response) => {
            if (response.statusCode == 200) {
                if (response.body.value) {
                    let storageAccounts: Model.StorageAccount[] = response.body.value;
                    result = result.concat(storageAccounts);
                }

                if (response.body.nextLink) {
                    var nextResult = await this.client.accumulateResultFromPagedResult(response.body.nextLink);
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
        }).catch(function (error) {
            deferred.reject(error);
        });

        return deferred.promise;
    }

    public async listClassicAndRMAccounts(options): Promise<Model.StorageAccount[]> {
        var httpRequest = new webClient.WebRequest();
         httpRequest.method = 'GET';
         httpRequest.headers = this.client.setCustomHeaders(options);

         // Getting all storage accounts (azure rm and classic, along with resource group names) for the given subscription.
         httpRequest.uri = "https://management.azure.com/resources?api-version=2014-04-01-preview&%24filter=(subscriptionId%20eq%20'{subscriptionId}')%20and%20(resourceType%20eq%20'microsoft.storage%2Fstorageaccounts'%20or%20resourceType%20eq%20'microsoft.classicstorage%2Fstorageaccounts')";
         httpRequest.uri = httpRequest.uri.replace('{subscriptionId}', this.client.subscriptionId);

         var deferred = Q.defer<Model.StorageAccount[]>();
         var result = [];
         this.client.beginRequest(httpRequest).then(async (response) => {
             if (response.statusCode == 200) {
                 if (response.body.value) {
                     let storageAccounts: Model.StorageAccount[] = response.body.value;
                     result = result.concat(storageAccounts);
                 }

                 if (response.body.nextLink) {
                     var nextResult = await this.client.accumulateResultFromPagedResult(response.body.nextLink);
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

    public async listKeys(resourceGroupName: string, accountName: string, options, storageAccountType?: string): Promise<string[]> {
        if (resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
            throw new Error(tl.loc("ResourceGroupCannotBeNull"));
        }

        if (accountName === null || accountName === undefined || typeof accountName.valueOf() !== 'string') {
            throw new Error(tl.loc("StorageAccountCannotBeNull"));
        }

        var apiVersion = "2017-06-01";
        var resourceProvider = "Microsoft.Storage";
        if (!!storageAccountType && storageAccountType.toLowerCase().indexOf("classicstorage") > 0) {
            resourceProvider = "Microsoft.ClassicStorage";
            apiVersion = "2015-12-01";
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.headers = this.client.setCustomHeaders(options);
        httpRequest.uri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/providers/{provider}/storageAccounts/{storageAccountName}/listKeys',
            {
                '{resourceGroupName}': resourceGroupName,
                '{storageAccountName}': accountName,
                '{provider}': resourceProvider
            },
            [],
            apiVersion
        );

        var deferred = Q.defer<string[]>();
        var accessKeys: string[] = [];
        this.client.beginRequest(httpRequest).then((response) => {
            if (response.statusCode == 200) {
                if (resourceProvider === "Microsoft.ClassicStorage") {
                    accessKeys[0] = response.body.primaryKey;
                    accessKeys[1] = response.body.secondaryKey;
                } else if (response.body.keys) {
                    let keys = response.body.keys;
                    for (let i = 0; i < keys.length; i++) {
                        accessKeys[i] = keys[i]["value"];
                    }
                }

                deferred.resolve(accessKeys);
            } else {
                deferred.reject(azureServiceClient.ToError(response));
            }
        }).catch(function (error) {
            deferred.reject(error);
        });

        return deferred.promise;
    }

    public async get(storageAccountName: string): Promise<Model.StorageAccount> {
        let storageAccounts = await this.list(null);
        let index = storageAccounts.findIndex(account => account.name.toLowerCase() === storageAccountName.toLowerCase());

        if (index < 0) {
            throw new Error(tl.loc("StorageAccountDoesNotExist", storageAccountName));
        }

        return storageAccounts[index];
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