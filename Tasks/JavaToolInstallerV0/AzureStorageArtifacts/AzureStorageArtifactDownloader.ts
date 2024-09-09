import * as  tl from 'azure-pipelines-task-lib/task';
import msRestAzure = require('azure-pipelines-tasks-azure-arm-rest/azure-arm-common');
import Model = require('azure-pipelines-tasks-azure-arm-rest/azureModels');
import armStorage = require('azure-pipelines-tasks-azure-arm-rest/azure-arm-storage');
import BlobService = require('azp-tasks-az-blobstorage-provider/blobservice');
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest/azureModels';
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint';
import { getAccessTokenViaWorkloadIdentityFederation } from './Auth';
import { ClientSecretCredential } from '@azure/identity';

export class AzureStorageArtifactDownloader {
  public connectedService: string;
  public azureStorageAccountName: string;
  public azureResourceGroupName?: string;
  public containerName: string;
  public commonVirtualPath: string;


  constructor(connectedService: string, azureStorageAccountName: string, containerName: string, commonVirtualPath: string, azureResourceGroupName?: string) {
    this.connectedService = connectedService;
    this.azureStorageAccountName = azureStorageAccountName;
    this.azureResourceGroupName = azureResourceGroupName;
    this.containerName = containerName;
    this.commonVirtualPath = commonVirtualPath;
  }

  public async downloadArtifacts(downloadToPath: string, fileType: string): Promise<void> {
    try {
      console.log(tl.loc('DownloadFromAzureBlobStorage', this.containerName));

      // Storage account details being fetched with Azure Resource Manager Service Connection
      const storageAccount: StorageAccountInfo = await this._getStorageAccountDetails();

      let blobService: BlobService.BlobService;

      //Check authorization scheme and init BlobService Accordingly
      const authorizationScheme = tl.getEndpointAuthorizationScheme(this.connectedService, true).toLowerCase();
      if(authorizationScheme !== 'workloadidentityfederation') {
        const accessToken = await getAccessTokenViaWorkloadIdentityFederation(this.connectedService);

        // Create the ClientSecretCredential using the obtained token
        const clientSecretCredential = new ClientSecretCredential(
          accessToken.tenantId,
          accessToken.clientId,
          accessToken.clientSecret
      );

        // Construct Blob Service using Client Secret Credential
        blobService = BlobService.createWithClientSecretCredential(storageAccount.name, clientSecretCredential);
      }
      else{
        // Construct Blob Service using Storage Account Access key
        blobService = BlobService.createWithAccessKey(storageAccount.name, storageAccount.primaryAccessKey);
      }

      // Blob Service being initialized with the Storage Account Primary Key. To be changed to Workload Identity Federation
     //let blobService = new BlobService.BlobService(storageAccount.name, storageAccount.primaryAccessKey);

      await blobService.downloadBlobs(downloadToPath, this.containerName, this.commonVirtualPath, fileType || "**");

    } catch (e) {
      if (e.statusCode === 414) throw new Error(tl.loc('RequestedUrlTooLong'));
      throw e;
    }
  }

  private async _getStorageAccountDetails(): Promise<StorageAccountInfo> {
    tl.debug("Getting storage account details for " + this.azureStorageAccountName);

    const subscriptionId: string = tl.getEndpointDataParameter(this.connectedService, "subscriptionId", false);
    const credentials = await this._getARMCredentials();
    const storageArmClient = new armStorage.StorageManagementClient(credentials, subscriptionId);

    const isUseOldStorageAccountQuery = process.env.AZP_TASK_FF_JAVATOOLINSTALLER_USE_OLD_SA_QUERY
      ? !!process.env.AZP_TASK_FF_JAVATOOLINSTALLER_USE_OLD_SA_QUERY
      : false;

    let storageAccount = null;
    if (this.azureResourceGroupName) {
      tl.debug("Group name is provided. Using fast query to get storage account details.");
      storageAccount = await this._getStorageAccountWithResourceGroup(storageArmClient, this.azureResourceGroupName, this.azureStorageAccountName);
    } 

    if (!storageAccount) {
      tl.debug("Group name is not provided or fast query failed. Using legacy query to get storage account details.");
      storageAccount = isUseOldStorageAccountQuery
        ? await this._legacyGetStorageAccount(storageArmClient)
        : await this._getStorageAccount(storageArmClient);
    
    }

    const storageAccountResourceGroupName = armStorage.StorageAccounts.getResourceGroupNameFromUri(storageAccount.id);

    tl.debug("Listing storage access keys...");
    const accessKeys = await storageArmClient.storageAccounts.listKeys(storageAccountResourceGroupName, this.azureStorageAccountName, null, storageAccount.type);

    return <StorageAccountInfo>{
      name: this.azureStorageAccountName,
      resourceGroupName: storageAccountResourceGroupName,
      primaryAccessKey: accessKeys[0]
    }
  }

  private async _legacyGetStorageAccount(storageArmClient: armStorage.StorageManagementClient): Promise<Model.StorageAccount> {
      const storageAccounts = await storageArmClient.storageAccounts.listClassicAndRMAccounts(null);
      const index = storageAccounts.findIndex(account => account.name.toLowerCase() == this.azureStorageAccountName.toLowerCase());
      if (index < 0) {
        throw new Error(tl.loc("StorageAccountDoesNotExist", this.azureStorageAccountName));
      }

      return storageAccounts[index];
  }

  private async _getStorageAccount(storageArmClient: armStorage.StorageManagementClient): Promise<Model.StorageAccount> {
      const storageAccount = await storageArmClient.storageAccounts.getClassicOrArmAccountByName(this.azureStorageAccountName, null);

      if (!storageAccount) {
        throw new Error(tl.loc('StorageAccountDoesNotExist', this.azureStorageAccountName));
      }

      return storageAccount;
  }

  private async _getStorageAccountWithResourceGroup(storageArmClient: armStorage.StorageManagementClient, resourceGroupName: string, storageAccountName: string): Promise<Model.StorageAccount | undefined> {
    let storageAccount = undefined;
    
    try {
      storageAccount = await storageArmClient.storageAccounts.getStorageAccountProperties(resourceGroupName, storageAccountName);
    } catch (e) {
      tl.warning("Failed to get storage account details using fast query.");
    }

    if (storageAccount) {
      tl.debug("Found storage account details using fast query.");
    }

    return storageAccount;
  }

  private async _getARMCredentials(): Promise<msRestAzure.ApplicationTokenCredentials> {
    const endpoint: AzureEndpoint = await new AzureRMEndpoint(this.connectedService).getEndpoint();
    return endpoint.applicationTokenCredentials;
  }
}

interface StorageAccountInfo {
  name: string;
  resourceGroupName: string;
  primaryAccessKey: string;
}