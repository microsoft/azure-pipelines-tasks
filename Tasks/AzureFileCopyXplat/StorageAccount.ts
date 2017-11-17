import path = require("path");
import tl = require("vsts-task-lib/task");
import fs = require("fs");
import util = require("util");

import env = require("./Environment");
import validateInputs = require("./ValidateInputs");
import armResource = require("azure-arm-rest/azure-arm-resource");
import winRM = require("./WinRMExtensionHelper");
import dgExtensionHelper = require("./DeploymentGroupExtensionHelper");
import { PowerShellParameters, NameValuePair } from "./ParameterParser";
import utils = require("./Utils");
import fileEncoding = require('./FileEncoding');
import { ParametersFileObject, TemplateObject, ParameterValue } from "../models/Types";
import Model = require("azure-arm-rest/azureModels");
import armStorage = require('azure-arm-rest/azure-arm-storage');
import BlobService = require('azure-blobstorage-artifactProvider/blobservice');

//To do
// loc messages
// premium storage account
// download to agent machine
// what should be the naming convention for script and blob? 1 approach - take timestamp till microsecond which will uniquefy
// create container for copy to azure vms
// ux inputs, messages
// in case of FromAzureBlob, can destination be a file? does noe seem valid. can it be restricted to folders only?
// blob prefix both to and from blob
// package.json
// make.json
// uts
// l2s
// modularize, refactor, move to common whatever possible
// in task.json, what does 'requred = true' and having a visibleRule mean?
// neither of cloud service/resource group may be present. Is this fine?
export class StorageAccount {
    private taskParameters: validateInputs.AzureFileCopyXplatTaskParameters;
    private azureStorageAccountName: string;
    constructor(taskParameters: validateInputs.AzureFileCopyXplatTaskParameters) {
        this.taskParameters = taskParameters;
    }

    public async uploadFilesToStorageBlob(taskParameters): Promise<void> {
        let storageAccount: StorageAccountInfo = await this._getStorageAccountDetails();
        let blobService = new BlobService.BlobService(storageAccount.name, storageAccount.primaryAccessKey);
        await blobService.uploadBlobs(this.taskParameters.sourcePath, this.taskParameters.containerName, "", "**");
        //upload script to download artifacts
    }

    public async downloadFilesFromStorageBlob(taskParameters): Promise<void> {
        let storageAccount: StorageAccountInfo = await this._getStorageAccountDetails();
        let blobService = new BlobService.BlobService(storageAccount.name, storageAccount.primaryAccessKey);
        await blobService.downloadBlobs(this.taskParameters.sourcePath, this.taskParameters.containerName, "", "**");
        //upload script to download artifacts
    }

    private async _getStorageAccountDetails(): Promise<StorageAccountInfo> {
        tl.debug("Getting storage account details for " + this.azureStorageAccountName);

        let subscriptionId: string = tl.getEndpointDataParameter(this.taskParameters.connectedService, "subscriptionId", false);
        let credentials = this.taskParameters.armCredentials;
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
}

interface StorageAccountInfo {
    name: string;
    resourceGroupName: string;
    primaryAccessKey: string;
}