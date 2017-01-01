var computeManagementClient = require("azure-arm-compute");
import util = require("util");
import tl = require("vsts-task-lib/task");
import azure_utils = require("./AzureUtil");
import deployAzureRG = require("./DeployAzureRG");
import Q = require('q');

export class MachineGroupAgentExtensionManager {
    private taskParameters: deployAzureRG.AzureRGTaskParameters;
    private credentials;
    private subscriptionId: string;
    private azureUtils;
    private failureCount: number;
    private successCount: number;
    private errors: string;
    private vmCount: number;
    private deferred;
    private operation: string;
    private computeClient;

    constructor(taskParameters: deployAzureRG.AzureRGTaskParameters) {
        this.taskParameters = taskParameters;
        this.credentials = this.taskParameters.credentials;
        this.subscriptionId = this.taskParameters.subscriptionId;
        this.azureUtils = new azure_utils.AzureUtil(this.taskParameters);
        this.successCount = 0;
        this.failureCount = 0;
        this.vmCount = 0;

        this.computeClient = new computeManagementClient(this.credentials, this.subscriptionId);
        return this;
    }

    public async installMGExtension() {
        this.deferred = Q.defer<string>();
        var operation = "installation";
        var listOfVms = await this.azureUtils.getVMDetails();
        this.vmCount = listOfVms.length;
        if (this.vmCount == 0) {
            this.deferred.resolve("");
        }
        for (var i = 0; i < listOfVms.length; i++) {
            var vmName = listOfVms[i]["name"];
            var extensionParameters = this.formExtensionParameters(listOfVms[i], operation);
            this.log("Adding " + extensionParameters["extensionName"] + " extension to virtual machine " + vmName);
            this.computeClient.virtualMachineExtensions.createOrUpdate(this.taskParameters.resourceGroupName, extensionParameters["vmName"], extensionParameters["extensionName"], extensionParameters["parameters"], this.givePostOperationCallBack(extensionParameters["extensionName"], extensionParameters["vmName"], operation));
        }
        return this.deferred.promise;
    }

    public async removeMGExtension() {
        var operation = "uninstallation";
        this.deferred = Q.defer<string>();
        var listOfVms = await this.azureUtils.getVMDetails();
        this.vmCount = listOfVms.length;
        if (this.vmCount == 0) {
            this.deferred.resolve("");
        }
        for (var i = 0; i < listOfVms.length; i++) {
            var vmName = listOfVms[i]["name"];
            var extensionParameters = this.formExtensionParameters(listOfVms[i], operation);
            this.log("Uninstalling " + extensionParameters["extensionName"] + " extension from virtual machine " + vmName);
            this.computeClient.virtualMachineExtensions.deleteMethod(this.taskParameters.resourceGroupName, extensionParameters["vmName"], extensionParameters["extensionName"], this.givePostOperationCallBack(extensionParameters["extensionName"], extensionParameters["vmName"], operation));
        }
        return this.deferred.promise;
    }

    private setTaskResult() {
        if (this.failureCount + this.successCount == this.vmCount) {
            if (this.failureCount > 0) {
                this.log("Machine group agent " + this.operation + " did not succeed on all VMs");
            }
            else {
                this.log("Machine group agent " + this.operation + " succeeded on all VMs");
            }
            this.deferred.resolve("");
        }
    }

    private givePostOperationCallBack(extensionName, vmName, operation) {
        var postOperationCallBack = (error, result, request, response) => {
            if (error) {
                this.failureCount++;
                this.errors += error.message;
                this.errors += "\n";
                this.log(operation + " of " + extensionName + " on " + vmName + " failed.");
            } else {
                this.successCount++;
                this.log(operation + " of " + extensionName + " on " + vmName + " succeeded.");
            }
            this.setTaskResult();
        }
        return postOperationCallBack;
    }

    private formExtensionParameters(virtualMachine, operation) {
        var vmId = virtualMachine["id"];
        var vmName = virtualMachine["name"];
        this.log("virtual machine : " + vmName);
        var vmOsType = virtualMachine["storageProfile"]["osDisk"]["osType"];
        this.log("Operating system on virtual machine : " + vmOsType);
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
        if (operation == "installation") {
            var autoUpgradeMinorVersion: boolean = true;
            var publisher: string = 'Microsoft.VisualStudio.Services';
            var extensionType: string = 'Microsoft.Compute/virtualMachines/extensions';
            //var collectionUri = tl.getVariable('system.TeamFoundationCollectionUri');
            //var teamProject = tl.getVariable('system.teamProject');
            var collectionUri = "https://testking123.visualstudio.com/";
            var teamProject = "AzureProj";
            var uriLength = collectionUri.length;
            if (collectionUri[uriLength - 1] == '/') {
                collectionUri = collectionUri.substr(0, uriLength - 1);
            }
            var tags = "";
            if (virtualMachine["tags"] && this.taskParameters.copyAzureVMTags) {
                this.log("Copying VM tags")
                tags = virtualMachine["tags"];
            }
            var publicSettings = { VSTSAccountName: collectionUri, TeamProject: teamProject, MachineGroup: this.taskParameters.machineGroupName, AgentName: "", Tags: tags };
            this.log("Public settings are :");
            this.log("VSTSAccountName : " + collectionUri);
            this.log("TeamProject : " + teamProject);
            this.log("MachineGroup : " + this.taskParameters.machineGroupName);
            this.log("Tags: " + tags);
            var protectedSettings = { PATToken: this.taskParameters.vstsPATToken };
            var parameters = { type: extensionType, virtualMachineExtensionType: virtualMachineExtensionType, typeHandlerVersion: typeHandlerVersion, publisher: publisher, autoUpgradeMinorVersion: autoUpgradeMinorVersion, location: vmLocation, settings: publicSettings, protectedSettings: protectedSettings };
        }
        this.log("VM Location: " + vmLocation);
        return { vmName: vmName, extensionName: extensionName, parameters: parameters };
    }

    private log(message){
        tl.debug(message);
        console.log(message);
    }

}