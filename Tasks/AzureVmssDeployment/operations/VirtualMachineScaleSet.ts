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

                if(!resourceGroupName) {
                    return reject(tl.loc("FailedToGetRGForVMSS", this.taskParameters.vmssName));
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
                                    "fileUris": [ this.taskParameters.customScriptUrl ],
                                    "commandToExecute": this.taskParameters.customScriptCommand
                                }
                            }
                        }
                    }

                    client.virtualMachineScaleSets.updateImage(resourceGroupName, this.taskParameters.vmssName, this.taskParameters.imageUrl, customScriptExtension, null, (error, result, request, response) => {
                        if (error) {
                            return reject(tl.loc("VMSSImageUpdateFailed", utils.getError(error)));
                        }
                        console.log(tl.loc("UpdatedVMSSImage"));
                        resolve();
                    });
                    break;
                }
            });
        });
    }

    private _getCustomScriptExtensionMetadata(osType): azureModel.VMExtensionMetadata {
        if(osType === "Windows") {
            return <azureModel.VMExtensionMetadata>{
                type: "CustomScriptExtension",
                publisher: "Microsoft.Compute",
                typeHandlerVersion: "1.8"
            }
        } else if(osType === "Linux") {
            return <azureModel.VMExtensionMetadata>{
                type: "CustomScriptForLinux",
                publisher: "Microsoft.OSTCExtensions",
                typeHandlerVersion: "1.5"
            }
        }
    }
}


