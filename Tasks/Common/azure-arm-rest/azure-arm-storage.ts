import msRestAzure = require("./azure-arm-common");
import azureServiceClient = require("./AzureServiceClient");
import tl = require('vsts-task-lib/task');
import Q = require('q');
import util = require("util");

export class StorageManagementClient extends azureServiceClient.ServiceClient {
    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: string) {
        super(credentials, subscriptionId);

        this.apiVersion = '2017-06-01';
        this.acceptLanguage = 'en-US';
        this.generateClientRequestId = true;
    }

    public getResourceGroupName(storageAccountName: string): Q.Promise<string> {
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'GET';
        // Getting all storage accounts (along with resource group names) for the given subscription.
        httpRequest.uri = this.getRequestUri(
            '//subscriptions/{subscriptionId}/providers/Microsoft.Storage/storageAccounts',
            {}
        );
        var resourceGroupName: string = "";
        var deferred = Q.defer<string>();
        this.beginRequest(httpRequest).then(function(result) {
            var httpResponse: azureServiceClient.WebResponse = result;
            var response = httpResponse.body["value"];
            for(let i = 0; i<response.length; i++) {
                var obj = response[i];
                if(obj["name"] == storageAccountName) {
                    var id = obj["id"];
                    resourceGroupName = StorageManagementClient.getResourceGroupNameFromUri(id);
                    break;
                }
            }
            if(resourceGroupName == "") {
                deferred.reject(new Error("Storage Account Name not found"));
            }
            deferred.resolve(resourceGroupName);
        }).catch(function(error) {
            deferred.reject(error);
        });

        return deferred.promise;
    }

    public getStorageAccountAccessKeys(resourceGroupName: string, storageAccountName: string): Q.Promise<string[]> {
        var httpRequest = new azureServiceClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.uri = this.getRequestUri(
            '//subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/providers/Microsoft.Storage/storageAccounts/{storageAccountName}/listKeys',
            {
                '{resourceGroupName}': resourceGroupName,
                '{storageAccountName}': storageAccountName
            }
        );
        var deferred = Q.defer<string[]>();
        this.beginRequest(httpRequest).then(function(result) {
            var httpResponse: azureServiceClient.WebResponse = result;
            var response = httpResponse.body["keys"];

            var accessKeys: string[] = [];
            // Parsing json to obtain array of strings (access keys).
            for(let i = 0; i<response.length; i++) {
                accessKeys[i] = response[i]["value"];
            }

            deferred.resolve(accessKeys);
        }).catch(function(error) {
            deferred.reject(error);
        });

        return deferred.promise;
    }

    public static getResourceGroupNameFromUri(resourceUri: string): string {
        if (this.isNonEmptyInternal(resourceUri)) {
            resourceUri = resourceUri.toLowerCase();
            return resourceUri.substring(resourceUri.indexOf("resourcegroups/") + "resourcegroups/".length, resourceUri.indexOf("/providers"));
        }
        return "";
    }

    private static isNonEmptyInternal(str: string): boolean {
        return (!!str && !!str.trim());
    }
}
