import tl = require("vsts-task-lib/task");
import msRestAzure = require("azure-arm-rest/azure-arm-common");
import armStorage = require("azure-arm-rest/azure-arm-storage");
import azcopy = require("./AzCopyUtils");
import util = require("util");
import Q = require('q');

export class AzureBlobUtils {
    public static armStorageClient: armStorage.StorageManagementClient;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: string) {
        AzureBlobUtils.armStorageClient = new armStorage.StorageManagementClient(credentials, subscriptionId);
    }

    public downloadBlobs(storageAccountName: string, containerName: string, commonVirtualPath:string, destLocation: string): Q.Promise<void> {
        if(!tl.osType().match(/^Win/)) {
            throw new Error(tl.osType()+' : OS type not supported with AzCopy');
        }

        var deferred = Q.defer<void>();
        var resourceGroupNamePromise: Q.Promise<string> = AzureBlobUtils.armStorageClient.getResourceGroupName(storageAccountName);
        resourceGroupNamePromise.then(function(resourceGroupName) {
            var storageAccountAccessKeysPromise: Q.Promise<string[]> = (AzureBlobUtils.armStorageClient).getStorageAccountAccessKeys(resourceGroupName, storageAccountName);
            storageAccountAccessKeysPromise.then(async function(accessKeys) {
                var storageAccountAccessKey = accessKeys[0];
                var sourceLocationUrl: string = util.format("https://%s.blob.core.windows.net/%s/%s",storageAccountName,containerName,commonVirtualPath);

                var azcopyClient = new azcopy.AzCopyUtils();
                azcopyClient.downloadAll(sourceLocationUrl, destLocation, storageAccountAccessKey);
            }).catch(function(error) {
                deferred.reject(error);
            });
        }).catch(function(error) {
            deferred.reject(error);
        });

        return deferred.promise;
    }
}
