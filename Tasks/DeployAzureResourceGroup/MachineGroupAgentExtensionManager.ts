var computeManagementClient = require("azure-arm-compute");
import util = require("util");
import tl = require("vsts-task-lib/task");
import azure_utils = require("./AzureUtil");
import deployAzureRG = require("./DeployAzureRG");
import Q = require("q");
import constants = require("./Constants");

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
        try {
            this.deferred = Q.defer<string>();
            var operation = "installation";
            var listOfVms = await this.azureUtils.getVMDetails();
            this.vmCount = listOfVms.length;
            if (this.vmCount == 0) {
                this.deferred.resolve("");
            }
            for (var i = 0; i < listOfVms.length; i++) {
                var vmName = listOfVms[i]["name"];
                var resourceGroupName = this.taskParameters.resourceGroupName;
                var extensionParameters = this.formExtensionParameters(listOfVms[i], operation);
                this.log(tl.loc("AddExtension", extensionParameters["extensionName"], vmName));
                var extensionName = extensionParameters["extensionName"];
                var parameters = extensionParameters["parameters"];
                var callback = this.givePostOperationCallBack(extensionName, vmName, operation);
                this.computeClient.virtualMachineExtensions.createOrUpdate(resourceGroupName, vmName, extensionName, parameters, callback);
            }
            return this.deferred.promise;
        }
        catch (exception) {
            this.log(tl.loc("MGAgentOperationOnAllVMsFailed", exception.message));
            tl.setResult(tl.TaskResult.Failed, tl.loc("MGAgentOperationOnAllVMsFailed", exception.message));
            this.deferred.resolve(tl.loc("MGAgentOperationOnAllVMsFailed", exception.message));
        }
    }

    public async deleteMGExtension() {
        try {
            var operation = "uninstallation";
            this.deferred = Q.defer<string>();
            var listOfVms = await this.azureUtils.getVMDetails();
            this.vmCount = listOfVms.length;
            if (this.vmCount == 0) {
                this.deferred.resolve("");
            }
            for (var i = 0; i < listOfVms.length; i++) {
                var vmName = listOfVms[i]["name"];
                var resourceGroupName = this.taskParameters.resourceGroupName;
                var extensionParameters = this.formExtensionParameters(listOfVms[i], operation);
                this.log(tl.loc("DeleteExtension", extensionParameters["extensionName"], vmName));
                var extensionName = extensionParameters["extensionName"];
                var callback = this.givePostOperationCallBack(extensionName, vmName, operation);
                this.computeClient.virtualMachineExtensions.deleteMethod(resourceGroupName, vmName, extensionName, callback);
            }
            return this.deferred.promise;
        }
        catch (exception) {
            this.log(tl.loc("MGAgentOperationOnAllVMsFailed", operation, exception.message));
            tl.setResult(tl.TaskResult.Failed, tl.loc("MGAgentOperationOnAllVMsFailed", operation, exception.message));
            this.deferred.reject(tl.loc("MGAgentOperationOnAllVMsFailed", operation, exception.message));
        }
    }

    private setTaskResult(operation) {
        if (this.failureCount + this.successCount == this.vmCount) {
            if (this.failureCount > 0) {
                this.log(tl.loc("MGAgentOperationOnAllVMsFailed", operation, ""));
                this.deferred.reject(operation);
            }
            else {
                this.log(tl.loc("MGAgentOperationOnAllVMsSucceeded", operation));
                this.deferred.resolve(operation);
            }
        }
    }

    private givePostOperationCallBack(extensionName, vmName, operation) {
        var postOperationCallBack = (error, result, request, response) => {
            if (error) {
                this.failureCount++;
                this.errors += error.message;
                this.errors += "\n";
                this.log(tl.loc("OperationFailed", operation, extensionName, vmName));
            } else {
                this.successCount++;
                this.log(tl.loc("OperationSucceeded", operation, extensionName, vmName));
            }
            this.setTaskResult(operation);
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
            var extensionName = constants.mgExtensionNameWindows;
            var virtualMachineExtensionType: string = constants.vmExtensionTypeWindows;
            var typeHandlerVersion: string = constants.version;
        }
        else if (vmOsType == "Linux") {
            extensionName = constants.mgExtensionNameLinux;
            virtualMachineExtensionType = constants.vmExtensionTypeLinux;
            typeHandlerVersion = constants.version;
        }
        this.log(tl.loc("MGAgentHandlerMajorVersion", typeHandlerVersion.split(".")[0]));
        if (operation == "installation") {
            var autoUpgradeMinorVersion: boolean = true;
            var publisher: string = constants.publisher;
            var extensionType: string = constants.extensionType;
            //var collectionUri = tl.getVariable('system.TeamFoundationCollectionUri');
            //var teamProject = tl.getVariable('system.teamProject');
            console.log("TeamFoundationCollectionUri is " + tl.getVariable('system.TeamFoundationCollectionUri'));
            console.log("TeamProject is " + tl.getVariable('system.teamProject'));
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
            var publicSettings = { 
                VSTSAccountName: collectionUri, 
                TeamProject: teamProject, 
                MachineGroup: this.taskParameters.machineGroupName, 
                AgentName: "", 
                Tags: tags 
            };
            this.log(tl.loc("PublicSettings", collectionUri, teamProject, this.taskParameters.machineGroupName, tags));
            var protectedSettings = { PATToken: this.taskParameters.vstsPATToken };
            var parameters = {
                type: extensionType,
                virtualMachineExtensionType: virtualMachineExtensionType,
                typeHandlerVersion: typeHandlerVersion,
                publisher: publisher,
                autoUpgradeMinorVersion: autoUpgradeMinorVersion,
                location: vmLocation,
                settings: publicSettings,
                protectedSettings: protectedSettings
            };
        }
        return { vmName: vmName, extensionName: extensionName, parameters: parameters };
    }

    private log(message) {
        tl.debug(message);
        console.log(message);
    }

}