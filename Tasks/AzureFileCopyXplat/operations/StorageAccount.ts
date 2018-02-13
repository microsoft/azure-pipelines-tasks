import path = require("path");
import tl = require("vsts-task-lib/task");
import util = require("util");
import azureStorage = require('azure-storage');
import validateInputs = require("./ValidateInputs");
import StorageAccountModel = require("../models/StorageAccountModel");

//To do
// classic vms
// ps, cmd, bash env. variables in paths. 
// BOM 
// clean target before copying
// output variables
// premium storage account
// copy in parallel
// should not early fail task if adding extension on one vm fails
// what if local blob server set uo, as given in storage/azcopy examples. http/https, etc?
// download to agent machine
// mode while creating the directory
// what should be the naming convention for script and blob? 1 approach - take timestamp till microsecond which will uniquefy
// create container for copy to azure vms
// ux inputs, messages
// loc messages
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
    private blobSvc: azureStorage.BlobService;
    private storageAcountModel: StorageAccountModel.StorageAccount;
    constructor(taskParameters: validateInputs.AzureFileCopyXplatTaskParameters) {
        this.taskParameters = taskParameters;
        this.storageAcountModel = new StorageAccountModel.StorageAccount(taskParameters);
    }

    public async uploadFilesToStorageBlob(taskParameters, sourcePath, containerName): Promise<void> {
        let storageAccount: StorageAccountModel.StorageAccountInfo = await this.storageAcountModel._getStorageAccountDetails();
        if(!this.blobSvc){
            this.blobSvc = azureStorage.createBlobService(storageAccount.name, storageAccount.primaryAccessKey);
        }
        await this.blobSvc.createContainerIfNotExists(containerName, null, function (error) {
            if (error) {
                throw new Error(tl.loc("ErrorInCreatingContainer"));
            }
        });

        let dotnetPath = path.join(".", "AzCopy_Linux/lib/azcopy/bin/azcopy.dll");
        let destination = util.format("https://%s.blob.core.windows.net/%s", this.taskParameters.storageAccount, containerName);
        if (this.taskParameters.blobPrefix) {
            destination += util.format("/%s", this.taskParameters.blobPrefix);
        }
        destination += util.format("/%s", path.basename(sourcePath));
        let args: string = util.format("%s --source %s --destination %s --dest-key %s %s --quiet", dotnetPath, sourcePath, destination, storageAccount.primaryAccessKey, this.taskParameters.additionalArguments);
        await tl.exec("dotnet", args)
    }

    public async uploadScriptsToStorageBlob(taskParameters): Promise<void> {
        let scriptsPath: string = path.resolve("..", "Scripts");
        await this.uploadFilesToStorageBlob(this.taskParameters, scriptsPath, this.taskParameters.containerNameScripts);
    }

    public async downloadFilesFromStorageBlob(taskParameters): Promise<void> {
        let storageAccount: StorageAccountModel.StorageAccountInfo = await this.storageAcountModel._getStorageAccountDetails();
        if(!this.blobSvc){
            this.blobSvc = azureStorage.createBlobService(storageAccount.name, storageAccount.primaryAccessKey);
        }
        await this.blobSvc.doesContainerExist(this.taskParameters.containerName, function (error) {
            if (error) {
                throw new Error(tl.loc("ContainerDoesNotExist"));
            }
        });

        let dotnetPath = path.join(".", "AzCopy_Linux/lib/azcopy/bin/azcopy.dll");
        let source = util.format("https://%s.blob.core.windows.net/%s", this.taskParameters.storageAccount, this.taskParameters.containerName);
        if (this.taskParameters.blobPrefix) {
            source += util.format("/%s", this.taskParameters.blobPrefix);
        }
        let args: string = util.format("%s --source %s --destination %s --dest-key %s %s --quiet", dotnetPath, source, path.dirname(this.taskParameters.destinationPath), storageAccount.primaryAccessKey, this.taskParameters.additionalArguments);
        await tl.exec("dotnet", args)
    }

    public async deleteTemporaryContainer(taskParameters): Promise<void> {
        let storageAccount: StorageAccountModel.StorageAccountInfo = await this.storageAcountModel._getStorageAccountDetails();
        if(!this.blobSvc){
            this.blobSvc = azureStorage.createBlobService(storageAccount.name, storageAccount.primaryAccessKey);
        }
        await this.blobSvc.deleteContainer(this.taskParameters.containerName, function (error) {
            if (error) {
                throw new Error(tl.loc("ErrorInDeletingContainer"));
            }
        });
    }
}
