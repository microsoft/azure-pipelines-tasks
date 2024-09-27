import * as  tl from 'azure-pipelines-task-lib/task';
import msRestAzure = require('azure-pipelines-tasks-azure-arm-rest/azure-arm-common');
import Model = require('azure-pipelines-tasks-azure-arm-rest/azureModels');
import armStorage = require('azure-pipelines-tasks-azure-arm-rest/azure-arm-storage');
import BlobService = require('azp-tasks-az-blobstorage-provider/blobservice');
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest/azureModels';
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint';

/**
 * Class responsible for downloading artifacts from Azure Blob Storage.
 * 
 * @class AzureStorageArtifactDownloader
 * 
 * @property {string} connectedService - The connected service name.
 * @property {string} azureStorageAccountName - The name of the Azure Storage account.
 * @property {string} [azureResourceGroupName] - The name of the Azure Resource Group (optional).
 * @property {string} containerName - The name of the container in Azure Blob Storage.
 * @property {string} commonVirtualPath - The common virtual path within the container.
 * 
 * @constructor
 * @param {string} connectedService - The connected service name.
 * @param {string} azureStorageAccountName - The name of the Azure Storage account.
 * @param {string} containerName - The name of the container in Azure Blob Storage.
 * @param {string} commonVirtualPath - The common virtual path within the container.
 * @param {string} [azureResourceGroupName] - The name of the Azure Resource Group (optional).
 * 
 * @method downloadArtifacts
 * @async
 * @param {string} downloadToPath - The local path where the artifacts will be downloaded.
 * @param {string} fileType - The type of files to download. If not specified, defaults to all files ("**").
 * @returns {Promise<void>} A promise that resolves when the download is complete.
 * @throws Will throw an error if the requested URL is too long (status code 414) or any other error occurs during the download process.
 * 
 * @method _getStorageAccountDetails
 * @async
 * @private
 * @returns {Promise<StorageAccountInfo>} A promise that resolves to the storage account details.
 * 
 * @method _legacyGetStorageAccount
 * @async
 * @private
 * @param {armStorage.StorageManagementClient} storageArmClient - The Azure Storage Management client.
 * @returns {Promise<Model.StorageAccount>} A promise that resolves to the legacy storage account details.
 * 
 * @method _getStorageAccount
 * @async
 * @private
 * @param {armStorage.StorageManagementClient} storageArmClient - The Azure Storage Management client.
 * @returns {Promise<Model.StorageAccount>} A promise that resolves to the storage account details.
 * 
 * @method _getStorageAccountWithResourceGroup
 * @async
 * @private
 * @param {armStorage.StorageManagementClient} storageArmClient - The Azure Storage Management client.
 * @param {string} resourceGroupName - The name of the Azure Resource Group.
 * @param {string} storageAccountName - The name of the Azure Storage account.
 * @returns {Promise<Model.StorageAccount | undefined>} A promise that resolves to the storage account details or undefined if not found.
 * 
 * @method _getARMCredentials
 * @async
 * @private
 * @returns {Promise<msRestAzure.ApplicationTokenCredentials>} A promise that resolves to the Azure Resource Manager credentials.
 */
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

  /**
   * Downloads artifacts from Azure Blob Storage to the specified local path.
   *
   * @param downloadToPath - The local path where the artifacts will be downloaded.
   * @param fileType - The type of files to download. If not specified, defaults to all files ("**").
   * @returns A promise that resolves when the download is complete.
   * @throws Will throw an error if the requested URL is too long (status code 414) or any other error occurs during the download process.
   */
  public async downloadArtifacts(downloadToPath: string, fileType: string): Promise<void> {
    try {
      console.log(tl.loc('DownloadFromAzureBlobStorage', this.containerName));

      const endpointObject = await this._getAzureRMEndpoint();
      const storageAccount: StorageAccountInfo = await this._getStorageAccountDetails();
      const blobService = new BlobService.BlobService(storageAccount.name, "", "", true, endpointObject);
      await blobService.downloadBlobs(downloadToPath, this.containerName, this.commonVirtualPath, fileType || "**");

    } catch (e) {
      if (e.statusCode === 414) throw new Error(tl.loc('RequestedUrlTooLong'));
      throw e;
    }
  }

  /**
   * Retrieves the storage account details for the specified Azure Storage Account.
   * 
   * This method first attempts to get the storage account details using the provided resource group name
   * for a faster query. If the resource group name is not provided or the fast query fails, it falls back
   * to a legacy query method.
   * 
   * @returns {Promise<StorageAccountInfo>} A promise that resolves to the storage account information.
   * 
   * @throws Will throw an error if the storage account details cannot be retrieved.
   * 
   * @private
   */
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
    tl.debug("Fetched Storage Account Resource Group name: " + storageAccountResourceGroupName);

    return <StorageAccountInfo>{
      name: this.azureStorageAccountName,
      resourceGroupName: storageAccountResourceGroupName
    }
  }

  /**
   * Retrieves a storage account from the list of classic and RM accounts.
   * 
   * @param storageArmClient - The storage management client used to list storage accounts.
   * @returns A promise that resolves to the storage account matching the specified name.
   * @throws An error if the storage account does not exist.
   */
  private async _legacyGetStorageAccount(storageArmClient: armStorage.StorageManagementClient): Promise<Model.StorageAccount> {
    const storageAccounts = await storageArmClient.storageAccounts.listClassicAndRMAccounts(null);
    const index = storageAccounts.findIndex(account => account.name.toLowerCase() == this.azureStorageAccountName.toLowerCase());
    if (index < 0) {
      throw new Error(tl.loc("StorageAccountDoesNotExist", this.azureStorageAccountName));
    }

    return storageAccounts[index];
  }

  /**
   * Retrieves the storage account details using the provided StorageManagementClient.
   * 
   * @param storageArmClient - The client used to manage storage accounts.
   * @returns A promise that resolves to the storage account details.
   * @throws Will throw an error if the storage account does not exist.
   */
  private async _getStorageAccount(storageArmClient: armStorage.StorageManagementClient): Promise<Model.StorageAccount> {
    const storageAccount = await storageArmClient.storageAccounts.getClassicOrArmAccountByName(this.azureStorageAccountName, null);

    if (!storageAccount) {
      throw new Error(tl.loc('StorageAccountDoesNotExist', this.azureStorageAccountName));
    }

    return storageAccount;
  }

  /**
   * Retrieves the storage account details for a given resource group and storage account name.
   * 
   * @param storageArmClient - The Storage Management Client used to interact with Azure Storage resources.
   * @param resourceGroupName - The name of the resource group containing the storage account.
   * @param storageAccountName - The name of the storage account to retrieve details for.
   * @returns A promise that resolves to the storage account details if found, or undefined if not found.
   * @throws Will log a warning if the storage account details cannot be retrieved using a fast query.
   */
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

  /**
   * Retrieves Azure Resource Manager (ARM) credentials.
   *
   * @returns {Promise<msRestAzure.ApplicationTokenCredentials>} A promise that resolves to the ARM credentials.
   * @private
   */
  private async _getARMCredentials(): Promise<msRestAzure.ApplicationTokenCredentials> {
    const endpoint: AzureEndpoint = await new AzureRMEndpoint(this.connectedService).getEndpoint();
    return endpoint.applicationTokenCredentials;
  }

  /**
   * Retrieves the full Azure Resource Manager (ARM) endpoint details.
   *
   * @returns {Promise<AzureEndpoint>} A promise that resolves to the AzureEndpoint.
   * @private
   */
  private async _getAzureRMEndpoint(): Promise<AzureEndpoint> {
    const endpoint: AzureEndpoint = await new AzureRMEndpoint(this.connectedService).getEndpoint();
    return endpoint;
  }
}

/**
 * Represents the information of an Azure Storage Account.
 * 
 * @interface StorageAccountInfo
 * @property {string} name - The name of the storage account.
 * @property {string} resourceGroupName - The name of the resource group that the storage account belongs to.
 */
interface StorageAccountInfo {
  name: string;
  resourceGroupName: string;
}