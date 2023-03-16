import path = require("path");
import os = require('os');
import util = require('util');
import tl = require("azure-pipelines-task-lib/task");

import armCompute = require('azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-compute');
import armStorage = require('azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-storage');
import azureModel = require('azure-pipelines-tasks-azure-arm-rest-v2/azureModels');
import BlobService = require('azp-tasks-az-blobstorage-provider/blobservice');
import compress = require('azure-pipelines-tasks-utility-common/compressutility');
import AzureVmssTaskParameters from "../models/AzureVmssTaskParameters";
import utils = require("./Utils")


export default class VirtualMachineScaleSet {
    private taskParameters: AzureVmssTaskParameters;

    constructor(taskParameters: AzureVmssTaskParameters) {
        this.taskParameters = taskParameters;
    }

    public async execute(): Promise<void> {
        var client = new armCompute.ComputeManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        var result = await this._getResourceGroupForVmss(client);
        var resourceGroupName: string = result.resourceGroupName;
        var osType: string = this.taskParameters.vmssOsType || result.osType;
        if (!resourceGroupName) {
            throw (tl.loc("FailedToGetRGForVMSS", this.taskParameters.vmssName));
        }

        switch (this.taskParameters.action) {
            case "UpdateImage":
            case "Update image":
                await this._configureAppUsingCustomScriptExtension(client, resourceGroupName, osType);
                await this._updateImageInternal(client, resourceGroupName);
                break;
            case "Configure application startup":
                await this._configureAppUsingCustomScriptExtension(client, resourceGroupName, osType);
                break;
            default:
                throw tl.loc("InvalidAction", this.taskParameters.action);
        }
    }

    private async _uploadCustomScriptsToBlobService(customScriptInfo: CustomScriptsInfo): Promise<string[]> {
        console.log(tl.loc("UploadingCustomScriptsBlobs", customScriptInfo.localDirPath))
        let storageDetails = customScriptInfo.storageAccount;
        let blobService = new BlobService.BlobService(storageDetails.name, storageDetails.primaryAccessKey);
        let blobsBaseUrl = util.format("%s%s/%s", storageDetails.primaryBlobUrl, "vststasks", customScriptInfo.blobsPrefixPath);

        console.log(tl.loc("DestinationBlobContainer", blobsBaseUrl))
        return await blobService.uploadBlobs(customScriptInfo.localDirPath, "vststasks", customScriptInfo.blobsPrefixPath);
    }

    private async _getStorageAccountDetails(): Promise<StorageAccountInfo> {
        tl.debug("Getting storage account details for " + this.taskParameters.customScriptsStorageAccount);
        var storageArmClient = new armStorage.StorageManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        let storageAccount: azureModel.StorageAccount = await storageArmClient.storageAccounts.get(this.taskParameters.customScriptsStorageAccount);

        let storageAccountResourceGroupName = utils.getResourceGroupNameFromUri(storageAccount.id);

        tl.debug("Listing storage access keys...");
        let accessKeys = await storageArmClient.storageAccounts.listKeys(storageAccountResourceGroupName, this.taskParameters.customScriptsStorageAccount, null);

        return <StorageAccountInfo>{
            name: this.taskParameters.customScriptsStorageAccount,
            primaryBlobUrl: storageAccount.properties.primaryEndpoints.blob,
            resourceGroupName: storageAccountResourceGroupName,
            primaryAccessKey: accessKeys[0]
        }
    }

    private async _configureAppUsingCustomScriptExtension(client: armCompute.ComputeManagementClient, resourceGroupName: string, osType: string): Promise<void> {
        if (!!this.taskParameters.customScriptsDirectory && !!this.taskParameters.customScript) {
            tl.debug("Preparing custom scripts...");
            let customScriptInfo: CustomScriptsInfo = await this._prepareCustomScripts(osType);
            //return;
            var extensionMetadata: azureModel.VMExtensionMetadata = this._getCustomScriptExtensionMetadata(osType);
            var customScriptExtension: azureModel.VMExtension = {
                name: "AzureVmssDeploymentTask",
                properties: {
                    type: extensionMetadata.type,
                    publisher: extensionMetadata.publisher,
                    typeHandlerVersion: extensionMetadata.typeHandlerVersion,
                    autoUpgradeMinorVersion: true,
                    settings: {
                        "commandToExecute": customScriptInfo.command,
                        "fileUris": customScriptInfo.blobUris
                    },
                    protectedSettings: {
                        "storageAccountName": customScriptInfo.storageAccount.name,
                        "storageAccountKey": customScriptInfo.storageAccount.primaryAccessKey
                    }
                }
            };

            var matchingExtension = await this._getExistingCustomScriptExtension(client, resourceGroupName, customScriptExtension);

            // if extension already exists, use the same name as the existing extension.
            if (!!matchingExtension) {
                customScriptExtension.name = matchingExtension.name;
            }

            await this._installCustomScriptExtension(client, resourceGroupName, customScriptExtension);
        }
    }

    private async _prepareCustomScripts(osType: string): Promise<CustomScriptsInfo> {
        // try to archive custom scripts so that it is more robust to transfer
        let archiveInfo: ArchiveInfo = this._archiveCustomScripts(osType);
        let customScriptInfo: CustomScriptsInfo = this._createCustomScriptInvoker(osType, archiveInfo);

        // upload custom script directory to blob storage
        try {
            var storageArmClient = new armStorage.StorageManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
            customScriptInfo.storageAccount = await this._getStorageAccountDetails();
            customScriptInfo.blobUris = await this._uploadCustomScriptsToBlobService(customScriptInfo);
        } catch (error) {
            throw tl.loc("UploadingToStorageBlobsFailed", error.message ? error.message : error);
        }

        return customScriptInfo;
    }

    private _createCustomScriptInvoker(osType: string, archiveInfo: ArchiveInfo): CustomScriptsInfo {
        let invokerScriptPath: string;
        let invokerCommand: string;

        let archiveFile = "";
        let packageDirectory = this.taskParameters.customScriptsDirectory;

        if (!!archiveInfo) {
            packageDirectory = archiveInfo.directory;
            archiveFile = archiveInfo.fileName
        }

        let blobsPefixPath = this._getBlobsPrefixPath();

        if (osType === "Windows") {
            // escape powershell special characters. This is needed as this script will be executed in a powershell session
            let script = this.taskParameters.customScript.replace(/`/g, '``').replace(/\$/g, '`$');

            // put an extra quote to handle space in script name
            let quotedScript = `.\\\\"${script}\"`

            // and escape quotes to handle this extra quote
            let escapedScript = quotedScript.replace(/'/g, "''").replace(/"/g, '"""');

            // escape powershell special characters
            let escapedArgs = "";
            if (this.taskParameters.customScriptArguments) {
                escapedArgs = this.taskParameters.customScriptArguments.replace(/`/g, '``').replace(/\$/g, '`$').replace(/'/g, "''").replace(/"/g, '"""');
            }

            invokerScriptPath = path.join(__dirname, "..", "Resources", "customScriptInvoker.ps1");
            invokerCommand = `powershell ./${blobsPefixPath}/customScriptInvoker.ps1 -zipName '${archiveFile}' -script '${escapedScript}' -scriptArgs '${escapedArgs}' -prefixPath '${blobsPefixPath}'`;
        } else {
            // escape shell special characters. This is needed as this script will be executed in a shell
            let script = this.taskParameters.customScript.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');

            // put an extra quote to handle space in script name
            let quotedScript = `./\"${script}\"`

            // and escape quotes to handle this extra quote...
            let escapedScript = quotedScript.replace(/'/g, "'\"'\"'");

            // escape shell special characters
            let escapedArgs = "";
            if (this.taskParameters.customScriptArguments) {
                escapedArgs = this.taskParameters.customScriptArguments.replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/'/g, "'\"'\"'");
            }

            invokerScriptPath = path.join(__dirname, "..", "Resources", "customScriptInvoker.sh");
            invokerCommand = `./customScriptInvoker.sh '${archiveFile}' '${escapedScript}' '${escapedArgs}'`;
        }

        // copy invoker script to same dir as archive
        tl.cp(invokerScriptPath, packageDirectory, "-f", false);
        console.log(tl.loc("CopiedInvokerScript", packageDirectory));

        tl.debug("Invoker command: " + invokerCommand);
        return <CustomScriptsInfo>{
            localDirPath: packageDirectory,
            command: invokerCommand,
            blobsPrefixPath: blobsPefixPath
        };
    }

    private _archiveCustomScripts(osType: string): ArchiveInfo {
        if (!this.taskParameters.skipArchivingCustomScripts) {
            try {
                console.log(tl.loc("ArchivingCustomScripts", this.taskParameters.customScriptsDirectory));
                let archive: ArchiveInfo = this._computeArchiveDetails(osType);

                if (!tl.exist(archive.directory)) {
                    tl.mkdirP(archive.directory);
                }

                // create archive file
                compress.createArchive(this.taskParameters.customScriptsDirectory, archive.compression, archive.filePath);
                console.log(tl.loc("CustomScriptsArchiveFile", archive.filePath));
                return archive;
            } catch (error) {
                tl.warning(tl.loc("CustomScriptsArchivingFailed") + " Error: " + error);
            }
        } else {
            console.log(tl.loc("SkippedArchivingCustomScripts"));
        }

        return null;
    }

    private _getResourceGroupForVmss(client: armCompute.ComputeManagementClient): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            client.virtualMachineScaleSets.list(null, (error, result, request, response) => {
                if (error) {
                    return reject(tl.loc("VMSSListFetchFailed", utils.getError(error)));
                }

                var vmssList: azureModel.VMSS[] = result;
                if (vmssList.length == 0) {
                    console.log(tl.loc("NoVMSSFound", this.taskParameters.vmssName));
                    return resolve();
                }

                var resourceGroupName: string;
                var osType: string;
                for (var i = 0; i < vmssList.length; i++) {
                    if (vmssList[i].name.toUpperCase() === this.taskParameters.vmssName.toUpperCase()) {
                        resourceGroupName = utils.getResourceGroupNameFromUri(vmssList[i].id);
                        osType = vmssList[i].properties.virtualMachineProfile.storageProfile.osDisk.osType;
                        break;
                    }
                }

                return resolve({ resourceGroupName: resourceGroupName, osType: osType });
            });
        });
    }

    private _getExistingCustomScriptExtension(client: armCompute.ComputeManagementClient, resourceGroupName: string, customScriptExtension: azureModel.VMExtension): Promise<azureModel.VMExtension> {
        return new Promise<azureModel.VMExtension>((resolve, reject) => {
            client.virtualMachineExtensions.list(resourceGroupName, this.taskParameters.vmssName, azureModel.ComputeResourceType.VirtualMachineScaleSet, null, (error, result, request, response) => {
                if (error) {
                    // Just log warning, do not fail
                    tl.warning(tl.loc("GetVMSSExtensionsListFailed", this.taskParameters.vmssName, utils.getError(error)));
                }

                var extensions: azureModel.VMExtension[] = result || [];
                var matchingExtension: azureModel.VMExtension = null;
                extensions.forEach((extension: azureModel.VMExtension) => {
                    if (extension.properties.type === customScriptExtension.properties.type &&
                        extension.properties.publisher === customScriptExtension.properties.publisher) {
                        matchingExtension = extension;
                        return;
                    }
                });

                return resolve(matchingExtension);
            });
        });
    }

    private _installCustomScriptExtension(client: armCompute.ComputeManagementClient, resourceGroupName: string, customScriptExtension: azureModel.VMExtension): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            client.virtualMachineExtensions.createOrUpdate(resourceGroupName, this.taskParameters.vmssName, azureModel.ComputeResourceType.VirtualMachineScaleSet, customScriptExtension.name, customScriptExtension, (error, result, request, response) => {
                if (error) {
                    return reject(tl.loc("SettingVMExtensionFailed", utils.getError(error)));
                }

                console.log(tl.loc("CustomScriptExtensionInstalled", customScriptExtension.name));
                return resolve();
            });
        });
    }

    private _updateImageInternal(client: armCompute.ComputeManagementClient, resourceGroupName: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            client.virtualMachineScaleSets.updateImage(resourceGroupName, this.taskParameters.vmssName, this.taskParameters.imageUrl, null, (error, result, request, response) => {
                if (error) {
                    return reject(tl.loc("VMSSImageUpdateFailed", this.taskParameters.vmssName, utils.getError(error)));
                }
                console.log(tl.loc("UpdatedVMSSImage"));
                return resolve();
            });
        });
    }

    private _getCustomScriptExtensionMetadata(osType: string): azureModel.VMExtensionMetadata {
        if (osType === "Windows") {
            return <azureModel.VMExtensionMetadata>{
                type: "CustomScriptExtension",
                publisher: "Microsoft.Compute",
                typeHandlerVersion: "1.0"
            }
        } else if (osType === "Linux") {
            return <azureModel.VMExtensionMetadata>{
                type: "CustomScript",
                publisher: "Microsoft.Azure.Extensions",
                typeHandlerVersion: "2.0"
            }
        }
    }

    private _computeArchiveDetails(osType: string): ArchiveInfo {
        let archive: ArchiveInfo = <ArchiveInfo>{};
        // create temp dir to store archived scripts
        // TODO: delete this dir
        archive.directory = path.join(os.tmpdir(), "vstsvmss" + Date.now().toString());

        // create archive name based on release/build info
        let archiveFileName = "cs";
        let archiveExt = osType === "Windows" ? ".zip" : ".tar.gz";
        archive.fileName = archiveFileName + archiveExt;
        archive.filePath = path.join(archive.directory, archive.fileName);

        // create zip archive for windows and .tar.gz archive for others
        // this will ensure that extracting archive is natively supported on VM
        archive.compression = osType === "Windows" ? "zip" : "targz";

        return archive;
    }

    private _getBlobsPrefixPath(): string {
        let uniqueValue = Date.now().toString();
        let releaseId = tl.getVariable("release.releaseid");
        let environmentId = tl.getVariable("release.environmentid");
        let releaseAttempt = tl.getVariable("release.attemptnumber");
        let prefixFolderPath: string = null;

        if (!!releaseId && !!environmentId && !!releaseAttempt) {
            prefixFolderPath = util.format("%s-%s/%s/%s", releaseId, uniqueValue, environmentId, releaseAttempt);
        } else {
            prefixFolderPath = util.format("%s-%s", tl.getVariable("build.buildid"), uniqueValue);
        }

        return prefixFolderPath;
    }
}

class StorageAccountInfo {
    public name: string;
    public resourceGroupName: string;
    public primaryBlobUrl: string;
    public primaryAccessKey: string;
}

class CustomScriptsInfo {
    public localDirPath: string;
    public command: string;
    public storageAccount: StorageAccountInfo;
    public blobUris: string[];
    public blobsPrefixPath: string;
}

class ArchiveInfo {
    fileName: string;
    filePath: string;
    directory: string;
    compression: string;
}