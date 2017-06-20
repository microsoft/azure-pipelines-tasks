import tl = require("vsts-task-lib/task");
import msRestAzure = require("./azure-rest/azure-arm-common");
import armStorage = require("./azure-rest/azure-arm-storage");
import azcopy = require("./AzCopyUtils");
import util = require("util");

export class AzureBlobUtils {
    public static armStorageClient: armStorage.StorageManagementClient;
    public static azCopyExeLocation: string;

    constructor(client: armStorage.StorageManagementClient, azCopyExeLocation: string) {
        AzureBlobUtils.armStorageClient = client;
        AzureBlobUtils.azCopyExeLocation = azCopyExeLocation;
    }

    public downloadFromBlob(storageAccountName: string, containerName: string, commonVirtualPath:string, destLocation: string): Q.Promise<void> {
        var resourceGroupNamePromise: Q.Promise<string> = AzureBlobUtils.armStorageClient.getResourceGroupName(storageAccountName);
        return resourceGroupNamePromise.then(function(resourceGroupName) {
            var storageAccountAccessKeysPromise: Q.Promise<string[]> = (AzureBlobUtils.armStorageClient).getStorageAccountAccessKeys(resourceGroupName, storageAccountName);
            storageAccountAccessKeysPromise.then(function(accessKeys) {
                var storageAccountAccessKey = accessKeys[0];
                var sourceLocationUrl: string = util.format("https://%s.blob.core.windows.net/%s/%s",storageAccountName,containerName,commonVirtualPath);

                azcopy.downloadAll(AzureBlobUtils.azCopyExeLocation, sourceLocationUrl, destLocation, storageAccountAccessKey);
            });
        });
    }
}
