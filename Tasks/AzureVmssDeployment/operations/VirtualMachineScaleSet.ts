import path = require("path");
import tl = require("vsts-task-lib/task");
import armCompute = require('azure-arm-rest/azure-arm-compute');
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
            client.virtualMachineScaleSets.list(null, (error, vmssList, request, response) => {
                if (error) {
                    return reject(tl.loc("VMSSListFetchFailed", this.taskParameters.vmssName, utils.getError(error)));
                }
                if (vmssList.length == 0) {
                    console.log(tl.loc("NoVMSSFound", this.taskParameters.vmssName));
                    return resolve();
                }

                var resourceGroupName: string;
                for (var i = 0; i < vmssList.length; i++) {
                    if(vmssList[i]["name"].toUpperCase() === this.taskParameters.vmssName.toUpperCase())
                    {
                        resourceGroupName = utils.getResourceGroupNameFromUri(vmssList[i]["id"]);
                        break;
                    }
                }

                if(!resourceGroupName) {
                    return reject(tl.loc("FailedToGetRGForVMSS", this.taskParameters.vmssName));
                }

                switch (this.taskParameters.action) {
                    case "UpdateImage":
                        client.virtualMachineScaleSets.updateImage(resourceGroupName, this.taskParameters.vmssName, this.taskParameters.imageUrl, null, (error, result, request, response) => {
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
}


