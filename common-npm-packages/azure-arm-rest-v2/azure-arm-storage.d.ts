import msRestAzure = require("./azure-arm-common");
import azureServiceClient = require("./AzureServiceClient");
import Model = require("./azureModels");
export declare class StorageManagementClient extends azureServiceClient.ServiceClient {
    storageAccounts: StorageAccounts;
    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: string, baseUri?: any, options?: any);
}
export declare class StorageAccounts {
    private client;
    constructor(client: any);
    list(options: any): Promise<Model.StorageAccount[]>;
    listClassicAndRMAccounts(options: any): Promise<Model.StorageAccount[]>;
    listKeys(resourceGroupName: string, accountName: string, options: any, storageAccountType?: string): Promise<string[]>;
    get(storageAccountName: string): Promise<Model.StorageAccount>;
    static getResourceGroupNameFromUri(resourceUri: string): string;
    private static isNonEmptyInternal(str);
}
