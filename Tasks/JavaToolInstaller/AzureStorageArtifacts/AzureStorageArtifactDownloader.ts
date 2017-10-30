import * as Q from 'q';
import * as  tl from 'vsts-task-lib/task';
import msRestAzure = require("azure-arm-rest/azure-arm-common");
import Model = require("azure-arm-rest/azureModels");
import armStorage = require('azure-arm-rest/azure-arm-storage');
import BlobService = require('azure-blobstorage-artifactProvider/blobservice');

export class AzureStorageArtifactDownloader {
  public connectedService: string;
  public azureStorageAccountName: string;
  public containerName: string;
  public commonVirtualPath: string;


  constructor() {
    this.connectedService = tl.getInput('ConnectedServiceNameARM', true);
    this.azureStorageAccountName = tl.getInput('storageAccountName', true);
    this.containerName = tl.getInput('containerName', true);
    this.commonVirtualPath = tl.getInput('commonVirtualPath', false);
  }

  public async downloadArtifacts(downloadToPath: string, fileEnding: string): Promise<void> {
    console.log(tl.loc('DownloadFromAzureBlobStorage', this.containerName));

    let storageAccount: StorageAccountInfo = await this._getStorageAccountDetails();

    let blobService = new BlobService.BlobService(storageAccount.name, storageAccount.primaryAccessKey);

    var fileType = "*" + fileEnding;
    await blobService.downloadBlobs(downloadToPath, this.containerName, this.commonVirtualPath, fileType || "**");
    await sleepFor(250); //Wait for the file to be released before returning.
    
  }

  private async _getStorageAccountDetails(): Promise<StorageAccountInfo> {
    tl.debug("Getting storage account details for " + this.azureStorageAccountName);

    let subscriptionId: string = tl.getEndpointDataParameter(this.connectedService, "subscriptionId", false);
    let credentials = this._getARMCredentials();
    let storageArmClient = new armStorage.StorageManagementClient(credentials, subscriptionId);
    let storageAccount: Model.StorageAccount = await this._getStorageAccount(storageArmClient);

    let storageAccountResourceGroupName = armStorage.StorageAccounts.getResourceGroupNameFromUri(storageAccount.id);

    tl.debug("Listing storage access keys...");
    let accessKeys = await storageArmClient.storageAccounts.listKeys(storageAccountResourceGroupName, this.azureStorageAccountName, null, storageAccount.type);

    return <StorageAccountInfo>{
      name: this.azureStorageAccountName,
      resourceGroupName: storageAccountResourceGroupName,
      primaryAccessKey: accessKeys[0]
    }
  }

  private async _getStorageAccount(storageArmClient: armStorage.StorageManagementClient): Promise<Model.StorageAccount> {
    let storageAccounts = await storageArmClient.storageAccounts.listClassicAndRMAccounts(null);
    let index = storageAccounts.findIndex(account => account.name.toLowerCase() == this.azureStorageAccountName.toLowerCase());
    if (index < 0) {
      throw new Error(tl.loc("StorageAccountDoesNotExist", this.azureStorageAccountName));
    }

    return storageAccounts[index];
  }

  private _getARMCredentials(): msRestAzure.ApplicationTokenCredentials {
    let servicePrincipalId: string = tl.getEndpointAuthorizationParameter(this.connectedService, "serviceprincipalid", false);
    let servicePrincipalKey: string = tl.getEndpointAuthorizationParameter(this.connectedService, "serviceprincipalkey", false);
    let tenantId: string = tl.getEndpointAuthorizationParameter(this.connectedService, "tenantid", false);
    let armUrl: string = tl.getEndpointUrl(this.connectedService, true);
    let envAuthorityUrl: string = tl.getEndpointDataParameter(this.connectedService, 'environmentAuthorityUrl', true);
    envAuthorityUrl = (envAuthorityUrl != null) ? envAuthorityUrl : "https://login.windows.net/";
    let activeDirectoryResourceId: string = tl.getEndpointDataParameter(this.connectedService, 'activeDirectoryServiceEndpointResourceId', false);
    activeDirectoryResourceId = (activeDirectoryResourceId != null) ? activeDirectoryResourceId : armUrl;
    let credentials = new msRestAzure.ApplicationTokenCredentials(servicePrincipalId, tenantId, servicePrincipalKey, armUrl, envAuthorityUrl, activeDirectoryResourceId, false);
    return credentials;
  }
}

function sleepFor(sleepDurationInMillisecondsSeconds): Promise<any> {
  return new Promise((resolve, reeject) => {
      setTimeout(resolve, sleepDurationInMillisecondsSeconds);
  });
}

interface StorageAccountInfo {
  name: string;
  resourceGroupName: string;
  primaryAccessKey: string;
}