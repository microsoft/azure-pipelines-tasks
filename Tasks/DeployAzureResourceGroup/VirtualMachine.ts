/// <reference path="../../definitions/node.d.ts" /> 
/// <reference path="../../definitions/vsts-task-lib.d.ts" /> 
  
import path = require("path");
import tl = require("vsts-task-lib/task");

var computeManagementClient = require('azure-arm-compute');

import deployAzureRG = require("./DeployAzureRG");

export class VirtualMachine {
    private taskParameters: deployAzureRG.AzureRGTaskParameters;
    private client;
    private failureCount:number;
    private successCount:number;
    private vmCount:number;
    private errors:string;

    constructor(taskParameters: deployAzureRG.AzureRGTaskParameters) {
        this.taskParameters = taskParameters;
        this.successCount = 0;
        this.failureCount = 0;
    }

    private postOperationCallBack = (error, result, request, response) => {
        if (error) {
            this.failureCount++;
            this.errors+=error.message;
            this.errors+="\n";
        } else {
            this.successCount++;
        }
        this.setTaskResult();
    }

    private setTaskResult() {
        if (this.failureCount + this.successCount == this.vmCount) {
            if(this.failureCount>0) {
                tl.setResult(tl.TaskResult.Failed,tl.loc("FailureOnVMOperation", this.taskParameters.action, this.errors));
                process.exit();
            } 
            tl.setResult(tl.TaskResult.Succeeded,tl.loc("SucceededOnVMOperation", this.taskParameters.action));
        }
    }

    public execute() {
        var client = new computeManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        client.virtualMachines.list(this.taskParameters.resourceGroupName, (error, listOfVms, request, response) => {
            if (error != undefined){
                tl.setResult(tl.TaskResult.Failed, tl.loc("VM_ListFetchFailed", this.taskParameters.resourceGroupName, error.message));
                process.exit();
            }
            if (listOfVms.length == 0) {
                console.log("No VMs found");
                tl.setResult(tl.TaskResult.Succeeded,tl.loc("SucceededOnVMOperation", this.taskParameters.action));
                process.exit();
            }
            this.vmCount = listOfVms.length;
            switch (this.taskParameters.action) {
                case "Create or update resource group":
                case "Select resource group":
                    if (this.taskParameters.enableDeploymentPrerequisites == "Configure VM agent with Machine Group Agent") {
                        for (var i = 0; i < listOfVms.length; i++) {
                            var vmName = listOfVms[i]["name"];
                            var extensionParameters = this.FormExtensionParameters(listOfVms[i], "enable");
                            tl.debug("Adding team services agent extension for virtual machine " + vmName);
                            client.virtualMachineExtensions.createOrUpdate(this.taskParameters.resourceGroupName, extensionParameters["vmName"], extensionParameters["extensionName"], extensionParameters["parameters"], this.postOperationCallBack);
                            tl.debug("After issuing create command");
                        }
                    }
                    break;
                case "DeleteRG":
                    if (this.taskParameters.enableDeploymentPrerequisites == "Configure VM agent with Machine Group Agent") {
                        for (var i = 0; i < listOfVms.length; i++) {
                            var vmName = listOfVms[i]["name"];
                            var extensionParameters = this.FormExtensionParameters(listOfVms[i], "uninstall");
                            tl.debug("Uninstalling team services agent extension for virtual machine " + vmName);
                            client.virtualMachineExtensions.deleteMethod(this.taskParameters.resourceGroupName, extensionParameters["vmName"], extensionParameters["extensionName"], extensionParameters["parameters"], this.postOperationCallBack);
                        }
                    }
                    break;
                case "Start":
                    for (var i = 0; i < listOfVms.length; i++) {
                        var vmName = listOfVms[i]["name"];
                        console.log(tl.loc("VM_Start", vmName));
                       client.virtualMachines.start(this.taskParameters.resourceGroupName, vmName, this.postOperationCallBack);
                    }
                    break;
                case "Stop":
                    for (var i = 0; i < listOfVms.length; i++) {
                        var vmName = listOfVms[i]["name"];
                        console.log(tl.loc("VM_Stop", vmName));
                        client.virtualMachines.powerOff(this.taskParameters.resourceGroupName, vmName, this.postOperationCallBack);
                    }
                    break;
                case "Restart":
                    for (var i = 0; i < listOfVms.length; i++) {
                        var vmName = listOfVms[i]["name"];
                        console.log(tl.loc("VM_Restart", vmName));
                        client.virtualMachines.restart(this.taskParameters.resourceGroupName, vmName, this.postOperationCallBack);
                    }
                    break;
                case "Delete":
                    for (var i = 0; i < listOfVms.length; i++) {
                        var vmName = listOfVms[i]["name"];
                        console.log(tl.loc("VM_Delete", vmName));
                        console.log(tl.loc("VM_Delete", vmName));
                        var extensionParameters = this.FormExtensionParameters(listOfVms[i], "uninstall");
                        tl.debug("Uninstalling team services agent extension for virtual machine " + vmName);
                        client.virtualMachineExtensions.deleteMethod(this.taskParameters.resourceGroupName, extensionParameters["vmName"], extensionParameters["extensionName"], extensionParameters["parameters"], (error, result, request, response) => {
                            if (error) {
                                tl.debug("Failed to delete the extension " + extensionParameters["extensionName"] + " on the vm " + extensionParameters["vmName"]);
                            }
                            else {
                                tl.debug("Successfully removed the extension " + extensionParameters["extensionName"] + " from the VM " + extensionParameters["vmName"]);
                            }
                            client.virtualMachines.deleteMethod(this.taskParameters.resourceGroupName, extensionParameters["vmName"], this.postOperationCallBack);
                        });
                    }
            }
        });
    }


        private FormExtensionParameters(virtualMachine, extensionAction) {
        var vmId = virtualMachine["id"];
        var vmName = virtualMachine["name"];
        var vmOsType = virtualMachine["storageProfile"]["osDisk"]["osType"];
        var vmLocation = virtualMachine["location"];

        if (vmOsType == "Windows") {
            var extensionName = "TeamServicesAgent";
            var virtualMachineExtensionType: string = 'TeamServicesAgent';
            var typeHandlerVersion: string = '1.0';
        }
        else if (vmOsType == "Linux") {
            extensionName = "TeamServicesAgentLinux";
            virtualMachineExtensionType = 'TeamServicesAgentLinux';
            typeHandlerVersion = '1.0';
        }
        var autoUpgradeMinorVersion: boolean = true;
        var publisher: string = 'Microsoft.VisualStudio.Services';
        var extensionType: string = 'Microsoft.Compute/virtualMachines/extensions';
        var collectionUri = tl.getVariable('system.TeamFoundationCollectionUri');
        var teamProject = tl.getVariable('system.teamProject');
        var uriLength = collectionUri.length;
        if (collectionUri[uriLength - 1] == '/') {
            collectionUri = collectionUri.substr(0, uriLength - 1);
        }
        var tags = "";
        if (!!virtualMachine["tags"]) {
            tags = virtualMachine["tags"];
        }

        var publicSettings = { VSTSAccountName: collectionUri, TeamProject: teamProject, MachineGroup: this.taskParameters.machineGroupName, AgentName: "", Tags: tags };
        var protectedSettings = { PATToken: this.taskParameters.vstsPATToken };
        var parameters = { type: extensionType, virtualMachineExtensionType: virtualMachineExtensionType, typeHandlerVersion: typeHandlerVersion, publisher: publisher, autoUpgradeMinorVersion: autoUpgradeMinorVersion, location: vmLocation, settings: publicSettings, protectedSettings: protectedSettings };
        tl.debug("VM Location: " + vmLocation);
        return { vmName: vmName, extensionName: extensionName, parameters: parameters };
    }

}

