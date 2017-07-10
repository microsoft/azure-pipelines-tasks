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

    public async execute(): Promise<void> {
        var client = new armCompute.ComputeManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        var result = await this._getResourceGroupForVmss(client);
        var resourceGroupName: string = result.resourceGroupName;
        var osType: string = result.osType;
        if(!resourceGroupName) {
            throw(tl.loc("FailedToGetRGForVMSS", this.taskParameters.vmssName));
        }

        switch (this.taskParameters.action) {
            case "UpdateImage":
                var extensionMetadata: azureModel.VMExtensionMetadata = null;
                if(!!this.taskParameters.customScriptUrl) {
                    extensionMetadata = this._getCustomScriptExtensionMetadata(osType);
                    var customScriptExtension: azureModel.VMExtension = {
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

                    var matchingExtension = await this._getExistingCustomScriptExtension(client, resourceGroupName, customScriptExtension);

                    // if extension already exists, remove it
                    if(!!matchingExtension) {
                        await this._deleteCustomScriptExtension(client, resourceGroupName, matchingExtension);
                    }

                    await this._installCustomScriptExtension(client, resourceGroupName, customScriptExtension);
                }

                await this._updateImageInternal(client, resourceGroupName);
                break;
        }
    }

    private _getResourceGroupForVmss(client: armCompute.ComputeManagementClient): Promise<any> {
        return new Promise<any>((resolve, reject) => {
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
                    if(extension.properties.type === customScriptExtension.properties.type &&
                    extension.properties.publisher === customScriptExtension.properties.publisher) {
                        matchingExtension = extension;
                        return;
                    }
                });

                return resolve(matchingExtension);
            });
        });
    }

    private _deleteCustomScriptExtension(client: armCompute.ComputeManagementClient, resourceGroupName: string, customScriptExtension: azureModel.VMExtension): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            console.log(tl.loc("RemovingCustomScriptExtension", customScriptExtension.name));
            client.virtualMachineExtensions.deleteMethod(resourceGroupName, this.taskParameters.vmssName, azureModel.ComputeResourceType.VirtualMachineScaleSet, customScriptExtension.name, (error, result, request, response) => {
                if (error) {
                    // Just log warning, do not fail
                    tl.warning(tl.loc("RemoveVMSSExtensionsFailed", customScriptExtension.name, utils.getError(error)));
                } else {
                    console.log(tl.loc("CustomScriptExtensionRemoved", customScriptExtension.name));
                }

                return resolve();
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
                    return reject(tl.loc("VMSSImageUpdateFailed", utils.getError(error)));
                }
                console.log(tl.loc("UpdatedVMSSImage"));
                return resolve();
            });
        });
    }

    private _getCustomScriptExtensionMetadata(osType: string): azureModel.VMExtensionMetadata {
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


