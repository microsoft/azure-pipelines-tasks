import * as  tl from 'azure-pipelines-task-lib/task';
import msRestAzure = require('azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-common');
import Model = require('azure-pipelines-tasks-azure-arm-rest-v2/azureModels');
import armStorage = require('azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-storage');
import BlobService = require('azp-tasks-az-blobstorage-provider-v2/blobservice');

export class AzureStorageArtifactDownloader {
  public connectedService: string;
  public azureStorageAccountName: string;
  public containerName: string;
  public commonVirtualPath: string;


  constructor(connectedService: string, azureStorageAccountName: string, containerName: string, commonVirtualPath: string) {
    this.connectedService = connectedService;
    this.azureStorageAccountName = azureStorageAccountName;
    this.containerName = containerName;
    this.commonVirtualPath = commonVirtualPath;
  }

  public async downloadArtifacts(downloadToPath: string, fileType: string): Promise<void> {
    console.log(tl.loc('DownloadFromAzureBlobStorage', this.containerName));

    const storageAccount: StorageAccountInfo = await this._getStorageAccountDetails();

    const blobService = new BlobService.BlobService(storageAccount.name, storageAccount.primaryAccessKey);

    await blobService.downloadBlobs(downloadToPath, this.containerName, this.commonVirtualPath, fileType || "**");
  }

  private async _getStorageAccountDetails(): Promise<StorageAccountInfo> {
    tl.debug("Getting storage account details for " + this.azureStorageAccountName);

    const subscriptionId: string = tl.getEndpointDataParameter(this.connectedService, "subscriptionId", false);
    const credentials = this._getARMCredentials();
    const storageArmClient = new armStorage.StorageManagementClient(credentials, subscriptionId);
    const storageAccount: Model.StorageAccount = await this._getStorageAccount(storageArmClient);

    const storageAccountResourceGroupName = armStorage.StorageAccounts.getResourceGroupNameFromUri(storageAccount.id);

    tl.debug("Listing storage access keys...");
    const accessKeys = await storageArmClient.storageAccounts.listKeys(storageAccountResourceGroupName, this.azureStorageAccountName, null, storageAccount.type);

    return <StorageAccountInfo>{
      name: this.azureStorageAccountName,
      resourceGroupName: storageAccountResourceGroupName,
      primaryAccessKey: accessKeys[0]
    }
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
    const servicePrincipalId: string = tl.getEndpointAuthorizationParameter(this.connectedService, "serviceprincipalid", false);
    const servicePrincipalKey: string = tl.getEndpointAuthorizationParameter(this.connectedService, "serviceprincipalkey", false);
    const tenantId: string = tl.getEndpointAuthorizationParameter(this.connectedService, "tenantid", false);
    const armUrl: string = tl.getEndpointUrl(this.connectedService, true);
    let envAuthorityUrl: string = tl.getEndpointDataParameter(this.connectedService, 'environmentAuthorityUrl', true);
    envAuthorityUrl = (envAuthorityUrl != null) ? envAuthorityUrl : "https://login.microsoftonline.com/";
    let activeDirectoryResourceId: string = tl.getEndpointDataParameter(this.connectedService, 'activeDirectoryServiceEndpointResourceId', false);
    activeDirectoryResourceId = (activeDirectoryResourceId != null) ? activeDirectoryResourceId : armUrl;
    const credentials = new msRestAzure.ApplicationTokenCredentials(
      servicePrincipalId,
      tenantId,
      servicePrincipalKey,
      armUrl,
      envAuthorityUrl,
      activeDirectoryResourceId,
      false,
      undefined, // scheme
      undefined, // msiClientId
      undefined, // authType
      undefined, // certFilePath
      undefined, // isADFSEnabled
      undefined, // access_token
      true       // Force set useMSAL = true
    );
    return credentials;
  }
}

interface StorageAccountInfo {
  name: string;
  resourceGroupName: string;
  primaryAccessKey: string;
}