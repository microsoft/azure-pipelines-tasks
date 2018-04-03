import path = require("path");
import tl = require("vsts-task-lib/task");
import util = require("util");
import azureStorage = require('azure-storage');
import validateInputs = require("./ValidateInputs");
import StorageAccountModel = require("../models/StorageAccountModel");
import fs = require('fs');

export class StorageAccount {
    private taskParameters: validateInputs.AzureFileCopyXplatTaskParameters;
    private azureStorageAccountName: string;
    private blobSvc: azureStorage.BlobService;
    private storageAcountModel: StorageAccountModel.StorageAccount;
    constructor(taskParameters: validateInputs.AzureFileCopyXplatTaskParameters) {
        this.taskParameters = taskParameters;
        this.storageAcountModel = new StorageAccountModel.StorageAccount(taskParameters);
    }

    public async uploadFilesToStorageBlob(taskParameters, sourcePath, containerName): Promise<void> {
        let storageAccount: StorageAccountModel.StorageAccountInfo = await this.storageAcountModel._getStorageAccountDetails();
        if (!this.blobSvc) {
            this.blobSvc = azureStorage.createBlobService(storageAccount.name, storageAccount.primaryAccessKey);
        }
        await this._ensureContainerExistence(containerName);

        let azCopyDllPath = path.join(process.cwd(), "AzCopy_Linux/azcopy/azcopy.dll");
        let destination = util.format("https://%s.blob.core.windows.net/%s", this.taskParameters.storageAccount, containerName);
        if (this.taskParameters.blobPrefix) {
            destination += util.format("/%s", this.taskParameters.blobPrefix);
        }
        destination += util.format("/%s", path.basename(sourcePath));
        let args: string = util.format("%s --recursive --source %s --destination %s --dest-key %s %s --quiet", azCopyDllPath, sourcePath, destination, storageAccount.primaryAccessKey, this.taskParameters.additionalArguments);
        await tl.exec("dotnet", args)
    }

    public async uploadScriptsToStorageBlob(taskParameters): Promise<void> {
        let scriptsPath: string = path.resolve(process.cwd(), "Scripts");
        await this.uploadFilesToStorageBlob(this.taskParameters, scriptsPath, this.taskParameters.containerNameScripts);
    }

    public async downloadFilesFromStorageBlob(taskParameters): Promise<void> {
        let storageAccount: StorageAccountModel.StorageAccountInfo = await this.storageAcountModel._getStorageAccountDetails();
        if (!this.blobSvc) {
            this.blobSvc = azureStorage.createBlobService(storageAccount.name, storageAccount.primaryAccessKey);
        }
        let containerExists: boolean = await this._checkContainerExistence(this.taskParameters.containerName);
        if (!containerExists) {
            throw new Error(tl.loc("ContainerDoesNotExist"));
        }

        let azCopyDllPath = path.join(process.cwd(), "AzCopy_Linux/azcopy/azcopy.dll");
        let source = util.format("https://%s.blob.core.windows.net/%s", this.taskParameters.storageAccount, this.taskParameters.containerName);
        if (this.taskParameters.blobPrefix) {
            source += util.format("/%s", this.taskParameters.blobPrefix);
        }
        var lstatDest = fs.lstatSync(this.taskParameters.destinationPath);
        if (lstatDest.isFile()) {
            this.taskParameters.destinationPath = path.dirname(this.taskParameters.destinationPath);
        }
        let args: string = util.format("%s --recursive --source %s --destination %s --source-key %s %s --quiet", azCopyDllPath, source, this.taskParameters.destinationPath, storageAccount.primaryAccessKey, this.taskParameters.additionalArguments);
        await tl.exec("dotnet", args)
    }

    public async deleteTemporaryContainer(containerName: string): Promise<void> {
        let storageAccount: StorageAccountModel.StorageAccountInfo = await this.storageAcountModel._getStorageAccountDetails();
        if (!this.blobSvc) {
            this.blobSvc = azureStorage.createBlobService(storageAccount.name, storageAccount.primaryAccessKey);
        }
        let containerExists: boolean = await this._checkContainerExistence(containerName);
        if (containerExists) {
            await this._deleteContainer(containerName);
        }
        console.log(tl.loc("ContainerDeletedSuccessfullyOrDoesNotExist"));
    }

    private _checkContainerExistence(containerName: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            var self = this;
            this.blobSvc.doesContainerExist(containerName, function (error, result, response) {
                if (!!error) {
                    console.log(tl.loc("FailedToCreateContainer", containerName, error.message));
                    reject(error);
                } else {
                    console.log(tl.loc("CreatedContainer", containerName));
                    if (!!result) {
                        resolve(true);
                    }
                    else {
                        resolve(false);
                    }
                }
            });
        });
    }

    private _deleteContainer(containerName: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            var self = this;
            this.blobSvc.deleteContainer(containerName, function (error) {
                if (!!error) {
                    console.log(tl.loc("FailedToDeleteContainer", containerName, error.message));
                    reject(error);
                } else {
                    console.log(tl.loc("DeletedContainer", containerName));
                    resolve();
                }
            });
        });
    }

    private _ensureContainerExistence(containerName: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            var self = this;
            this.blobSvc.createContainerIfNotExists(containerName, { publicAccessLevel: 'container' }, function (error, result, response) {
                if (!!error) {
                    console.log(tl.loc("FailedToCreateContainer", containerName, error.message));
                    reject(error);
                } else {
                    console.log(tl.loc("CreatedContainer", containerName));
                    resolve();
                }
            });
        });
    }
}
