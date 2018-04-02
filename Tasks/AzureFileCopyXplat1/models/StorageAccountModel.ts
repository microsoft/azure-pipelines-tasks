import msRestAzure = require('azure-arm-rest/azure-arm-common');
import validateInputs = require("../operations/ValidateInputs");
import armStorage = require('azure-arm-rest/azure-arm-storage');
import Model = require('azure-arm-rest/azureModels');
import tl = require("vsts-task-lib/task");

export interface StorageAccountInfo {
    name: string;
    resourceGroupName: string;
    primaryAccessKey: string;
}

export class StorageAccount {
    private azureStorageAccountName;
    private storageAccount: StorageAccountInfo;
    private taskParameters: validateInputs.AzureFileCopyXplatTaskParameters;
    constructor(taskParameters: validateInputs.AzureFileCopyXplatTaskParameters) {
        this.taskParameters = taskParameters;
        this.azureStorageAccountName = taskParameters.storageAccount;
    }
    public async _getStorageAccountDetails(): Promise<StorageAccountInfo> {
        if (!this.storageAccount) {
            tl.debug("Getting storage account details for " + this.azureStorageAccountName);

            const subscriptionId: string = tl.getEndpointDataParameter(this.taskParameters.connectedService, "subscriptionId", false);
            const credentials = this._getARMCredentials();
            const storageArmClient = new armStorage.StorageManagementClient(credentials, subscriptionId);
            const storageAccount: Model.StorageAccount = await this._getStorageAccount(storageArmClient);

            const storageAccountResourceGroupName = armStorage.StorageAccounts.getResourceGroupNameFromUri(storageAccount.id);

            tl.debug("Listing storage access keys...");
            const accessKeys = await storageArmClient.storageAccounts.listKeys(storageAccountResourceGroupName, this.azureStorageAccountName, null, storageAccount.type);
            this.storageAccount = <StorageAccountInfo>{
                name: this.azureStorageAccountName,
                resourceGroupName: storageAccountResourceGroupName,
                primaryAccessKey: accessKeys[0]
            }
        }
        return this.storageAccount;
    }

    private async _getStorageAccount(storageArmClient: armStorage.StorageManagementClient): Promise<Model.StorageAccount> {
        const storageAccounts = await storageArmClient.storageAccounts.listClassicAndRMAccounts(null);
        const index = storageAccounts.findIndex(account => account.name.toLowerCase() == this.azureStorageAccountName.toLowerCase());
        if (index < 0) {
            throw new Error(tl.loc("StorageAccountDoesNotExist", this.azureStorageAccountName));
        }

        return storageAccounts[index];
    }

    private _getARMCredentials(): msRestAzure.ApplicationTokenCredentials {
        const servicePrincipalId: string = tl.getEndpointAuthorizationParameter(this.taskParameters.connectedService, "serviceprincipalid", false);
        const servicePrincipalKey: string = tl.getEndpointAuthorizationParameter(this.taskParameters.connectedService, "serviceprincipalkey", false);
        const tenantId: string = tl.getEndpointAuthorizationParameter(this.taskParameters.connectedService, "tenantid", false);
        const armUrl: string = tl.getEndpointUrl(this.taskParameters.connectedService, true);
        let envAuthorityUrl: string = tl.getEndpointDataParameter(this.taskParameters.connectedService, 'environmentAuthorityUrl', true);
        envAuthorityUrl = (envAuthorityUrl != null) ? envAuthorityUrl : "https://login.windows.net/";
        let activeDirectoryResourceId: string = tl.getEndpointDataParameter(this.taskParameters.connectedService, 'activeDirectoryServiceEndpointResourceId', false);
        activeDirectoryResourceId = (activeDirectoryResourceId != null) ? activeDirectoryResourceId : armUrl;
        const credentials = new msRestAzure.ApplicationTokenCredentials(servicePrincipalId, tenantId, servicePrincipalKey, armUrl, envAuthorityUrl, activeDirectoryResourceId, false);
        return credentials;
    }
}