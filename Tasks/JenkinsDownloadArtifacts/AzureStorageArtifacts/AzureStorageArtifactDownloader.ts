import * as Q from 'q';
import * as  tl from 'vsts-task-lib/task';
import msRestAzure = require("azure-arm-rest/azure-arm-common");
import Model = require("azure-arm-rest/azureModels");
import armStorage = require('azure-arm-rest/azure-arm-storage');
import BlobService = require('azure-blobstorage-artifactProvider/blobservice');

export class AzureStorageArtifactDownloader {
  public connectedService: string;
  public azureRmStorageAccount: string;
  public containerName: string;
  public commonVirtualPath: string;


  constructor() {
    this.connectedService = tl.getInput('ConnectedServiceNameARM', true);
    this.azureRmStorageAccount = tl.getInput('storageAccountName', true);
    this.containerName = tl.getInput('containerName', true);
    this.commonVirtualPath = tl.getInput('commonVirtualPath', false);
  }

  public async downloadArtifacts(downloadToPath: string): Promise<void>{
    console.log(tl.loc('DownloadFromAzureBlobStorage', this.containerName));

    let storageAccount: StorageAccountInfo = await this._getStorageAccountDetails(this.azureRmStorageAccount);

    let blobService = new BlobService.BlobService(storageAccount.name, storageAccount.primaryAccessKey);

    await blobService.downloadBlobs(downloadToPath, this.containerName, this.commonVirtualPath, tl.getInput('itemPattern', false) || "**");
  }

  private async _getStorageAccountDetails(storageAccountName: string): Promise<StorageAccountInfo> {
    tl.debug("Getting storage account details for " + storageAccountName);

    let subscriptionId: string = tl.getEndpointDataParameter(this.connectedService, "subscriptionId", false);
    let credentials = this._getARMCredentials();
    let storageArmClient = new armStorage.StorageManagementClient(credentials, subscriptionId);
    let storageAccount: Model.StorageAccount = await storageArmClient.storageAccounts.get(storageAccountName);

    let storageAccountResourceGroupName = armStorage.StorageAccounts.getResourceGroupNameFromUri(storageAccount.id);

    tl.debug("Listing storage access keys...");
    let accessKeys = await storageArmClient.storageAccounts.listKeys(storageAccountResourceGroupName, storageAccountName, null);

    return <StorageAccountInfo>{
      name: storageAccountName,
      resourceGroupName: storageAccountResourceGroupName,
      primaryAccessKey: accessKeys[0]
    }
  }

  private _getARMCredentials(): msRestAzure.ApplicationTokenCredentials {
    var servicePrincipalId: string = tl.getEndpointAuthorizationParameter(this.connectedService, "serviceprincipalid", false);
    var servicePrincipalKey: string = tl.getEndpointAuthorizationParameter(this.connectedService, "serviceprincipalkey", false);
    var tenantId: string = tl.getEndpointAuthorizationParameter(this.connectedService, "tenantid", false);
    var armUrl: string = tl.getEndpointUrl(this.connectedService, true);
    var envAuthorityUrl: string = tl.getEndpointDataParameter(this.connectedService, 'environmentAuthorityUrl', true);
    envAuthorityUrl = (envAuthorityUrl != null) ? envAuthorityUrl : "https://login.windows.net/";
    var activeDirectoryResourceId: string = tl.getEndpointDataParameter(this.connectedService, 'activeDirectoryServiceEndpointResourceId', false);
    activeDirectoryResourceId = (activeDirectoryResourceId != null) ? activeDirectoryResourceId : armUrl;
    var credentials = new msRestAzure.ApplicationTokenCredentials(servicePrincipalId, tenantId, servicePrincipalKey, armUrl, envAuthorityUrl, activeDirectoryResourceId, false);
    return credentials;
  }
}

interface StorageAccountInfo {
  name: string;
  resourceGroupName: string;
  primaryAccessKey: string;
}