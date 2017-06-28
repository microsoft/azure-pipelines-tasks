import path = require("path");
import tl = require("vsts-task-lib/task");
import armCompute = require('azure-arm-rest/azure-arm-compute');
import azureModel = require('azure-arm-rest/azureModels');
import AzureVmssTaskParameters from "../models/AzureVmssTaskParameters";
import utils = require("./Utils")

export default class VirtualMachineScaleSet {
    private taskParameters: AzureVmssTaskParameters;

    constructor(taskParameters: AzureVmssTaskParameters) {
        this.taskParameters = taskParameters;
    }

    public execute(): Promise<void> {
        var client = new armCompute.ComputeManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        return new Promise<void>((resolve, reject) => {
            this._getResourceGroupForVmss(client,resolve, reject, (error, result, request, response) => {
                var resourceGroupName: string = result.resourceGroupName;
                var osType: string = result.osType;
                if(!resourceGroupName) {
                    return reject(tl.loc("FailedToGetRGForVMSS", this.taskParameters.vmssName));
                }

                switch (this.taskParameters.action) {
                    case "UpdateImage":
                    var extensionMetadata: azureModel.VMExtensionMetadata = null;
                    var customScriptExtension: azureModel.VMExtension = null;
                    if(!!this.taskParameters.customScriptUrl) {
                        extensionMetadata = this._getCustomScriptExtensionMetadata(osType);
                         customScriptExtension = {
                            name: "CustomScriptExtension" + Date.now().toString(),
                            properties: {
                                type: extensionMetadata.type,
                                publisher: extensionMetadata.publisher,
                                typeHandlerVersion: extensionMetadata.typeHandlerVersion,
                                autoUpgradeMinorVersion: true,
                                settings: {
                                    "fileUris": [ this.taskParameters.customScriptUrl ]
                                },
                                protectedSettings: {
                                    "commandToExecute": this.taskParameters.customScriptCommand
                                }
                            }
                        };

                        this._getExistingCustomScriptExtension(client, resourceGroupName, customScriptExtension, (error, matchingExtension, request, response) => {
                            // if extension already exists, remove it
                            if(!!matchingExtension) {
                                this._deleteAndInstallCustomScriptExtension(client, resourceGroupName, matchingExtension, customScriptExtension, resolve, reject, (error, matchingExtension, request, response) => {
                                    this._updateImageInternal(client, resourceGroupName, resolve, reject);
                                });
                            } else {
                                this._installCustomScripExtension(client, resourceGroupName, customScriptExtension, resolve, reject, (error, result, request, response) => {
                                    this._updateImageInternal(client, resourceGroupName, resolve, reject);
                                });
                            }
                        });
                    } else {
                        this._updateImageInternal(client, resourceGroupName, resolve, reject);
                    }

                    break;
                }
            });
        });
    }

    private _getResourceGroupForVmss(client, resolve, reject, callback): void {
        client.virtualMachineScaleSets.list(null, (error, result, request, response) => {
            if (error) {
                return reject(tl.loc("VMSSListFetchFailed", this.taskParameters.vmssName, utils.getError(error)));
            }

            var vmssList: azureModel.VMSS[] = result;
            if (vmssList.length == 0) {
                console.log(tl.loc("NoVMSSFound", this.taskParameters.vmssName));
                return resolve();
            }

            var resourceGroupName: string;
            var osType: string;
            for (var i = 0; i < vmssList.length; i++) {
                if(vmssList[i].name.toUpperCase() === this.taskParameters.vmssName.toUpperCase())
                {
                    resourceGroupName = utils.getResourceGroupNameFromUri(vmssList[i].id);
                    osType = vmssList[i].properties.virtualMachineProfile.storageProfile.osDisk.osType;
                    break;
                }
            }

            callback(null, { resourceGroupName: resourceGroupName, osType: osType });
        });
    }

    private _getExistingCustomScriptExtension(client, resourceGroupName, customScriptExtension, callback): void {
        client.virtualMachineExtensions.list(resourceGroupName, this.taskParameters.vmssName, azureModel.ComputeResourceType.VirtualMachineScaleSet, null, (error, result, request, response) => {
            if (error) {
                // Just log warning, do not fail
                tl.warning(tl.loc("GetVMSSExtensionsListFailed", this.taskParameters.vmssName, utils.getError(error)));
            }

            var extensions: azureModel.VMExtension[] = result || [];
            var matchingExtension: azureModel.VMExtension = null;
            extensions.forEach((extension: azureModel.VMExtension) => {
                if(extension.properties.type === customScriptExtension.properties.type &&
                extension.properties.publisher === customScriptExtension.properties.publisher) {
                    matchingExtension = extension;
                    return;
                }
            });

            callback(null, matchingExtension);
        });
    }

    private _deleteAndInstallCustomScriptExtension(client, resourceGroupName, oldExtension, newExtension, resolve, reject, callback): void {
        console.log(tl.loc("RemovingCustomScriptExtension", oldExtension.name));
        client.virtualMachineExtensions.deleteMethod(resourceGroupName, this.taskParameters.vmssName, azureModel.ComputeResourceType.VirtualMachineScaleSet, oldExtension.name, (error, result, request, response) => {
            if (error) {
                // Just log warning, do not fail
                tl.warning(tl.loc("RemoveVMSSExtensionsFailed", oldExtension.name, utils.getError(error)));
            } else {
                console.log(tl.loc("CustomScriptExtensionRemoved", oldExtension.name));
            }

            client.virtualMachineExtensions.createOrUpdate(resourceGroupName, this.taskParameters.vmssName, azureModel.ComputeResourceType.VirtualMachineScaleSet, newExtension.name, newExtension, (error, result, request, response) => {
                if (error) {
                    return reject(tl.loc("SettingVMExtensionFailed", utils.getError(error)));
                }

                console.log(tl.loc("CustomScriptExtensionInstalled", newExtension.name));
                callback(null, null);
            });
        });
    }

    private _installCustomScripExtension(client, resourceGroupName, customScriptExtension, resolve, reject, callback): void {
        client.virtualMachineExtensions.createOrUpdate(resourceGroupName, this.taskParameters.vmssName, azureModel.ComputeResourceType.VirtualMachineScaleSet, customScriptExtension.name, customScriptExtension, (error, result, request, response) => {
            if (error) {
                return reject(tl.loc("SettingVMExtensionFailed", utils.getError(error)));
            }

            console.log(tl.loc("CustomScriptExtensionInstalled", customScriptExtension.name));
            callback(null, null);
        });
    }

    private _updateImageInternal(client, resourceGroupName, resolve, reject) {
        client.virtualMachineScaleSets.updateImage(resourceGroupName, this.taskParameters.vmssName, this.taskParameters.imageUrl, null, (error, result, request, response) => {
            if (error) {
                return reject(tl.loc("VMSSImageUpdateFailed", utils.getError(error)));
            }
            console.log(tl.loc("UpdatedVMSSImage"));
            return resolve();
        });
    }

    private _getCustomScriptExtensionMetadata(osType): azureModel.VMExtensionMetadata {
        if(osType === "Windows") {
            return <azureModel.VMExtensionMetadata>{
                type: "CustomScriptExtension",
                publisher: "Microsoft.Compute",
                typeHandlerVersion: "1.0"
            }
        } else if(osType === "Linux") {
            return <azureModel.VMExtensionMetadata>{
                type: "CustomScriptForLinux",
                publisher: "Microsoft.OSTCExtensions",
                typeHandlerVersion: "1.0"
            }
        }
    }
}


