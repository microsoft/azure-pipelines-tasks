import computeManagementClient = require("./azure-rest/azure-arm-compute");
import util = require("util");
import tl = require("vsts-task-lib/task");
import azure_utils = require("./AzureUtil");
import deployAzureRG = require("../models/DeployAzureRG");
import az = require("./azure-rest/azureModels");

export class MachineGroupExtensionHelper {
    private taskParameters: deployAzureRG.AzureRGTaskParameters;
    private azureUtils: azure_utils.AzureUtil;
    private computeClient: computeManagementClient.ComputeManagementClient;
    private constants: Constants;

    constructor(taskParameters: deployAzureRG.AzureRGTaskParameters) {
        this.taskParameters = taskParameters;
        this.computeClient = new computeManagementClient.ComputeManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        this.azureUtils = new azure_utils.AzureUtil(this.taskParameters, this.computeClient);
        this.constants = new Constants();
    }
    public async installExtension() {
        var operationParameters: OperationParameters = new OperationParameters("installation");
        var listOfVms: az.VM[] = await this.azureUtils.getVMDetails();
        var extensionInstalledOnVMsPromises: Promise<any>[] = [];
        operationParameters.vmCount = listOfVms.length;
        extensionInstalledOnVMsPromises.push(this.installExtensionOnSingleVM(operationParameters, listOfVms));
        await Promise.all(extensionInstalledOnVMsPromises);
        this.finalizeResult(operationParameters);
    }

    private async installExtensionOnSingleVM(operationParameters, listOfVms) {
        for (var vm of listOfVms) {
            var vmName = vm.name;
            var resourceGroupName = this.taskParameters.resourceGroupName;
            var vmInstanceView: az.VM = await this.getVmInstanceView(resourceGroupName, vmName, { expand: 'instanceView' }, operationParameters);
            var extensionParameters = this._formExtensionParameters(vm, operationParameters.operation);
            var extensionName = extensionParameters["extensionName"];
            var parameters = extensionParameters["parameters"];
            var statuses = vmInstanceView.properties.instanceView.statuses;
            for (var i = 0; i < statuses.length; i++) {
                var status = statuses[i]["code"].split("/");
                if (status.length > 1 && status[0] === "PowerState") {
                    if (status[1] === "running") {
                        this.log(tl.loc("AddExtension", extensionName, vmName));
                        await this.installExtensionOnRunningVm(operationParameters, vmName, extensionName, parameters);
                    }
                    else if (status[1] === "deallocated") {
                        await this.startVmAndInstallExtension(operationParameters, vmName, extensionName, parameters);
                    }
                    else {
                        var errMsg = tl.loc("VMTransitioningSkipExtensionOperation", vmName, operationParameters.operation, extensionName);
                        this.log(errMsg);
                        await Promise.reject(tl.loc("VMTransitioningSkipExtensionOperation", vmName, operationParameters.operation, extensionName));
                    }
                    break;
                }
            }
            console.log("here");
        }
    }

    public async deleteMGExtensionRG(): Promise<void> {
        var operationParameters = new OperationParameters("uninstallation");
        var listOfVms = await this.azureUtils.getVMDetails();
        operationParameters.vmCount = listOfVms.length;
        var deleteExtensionFromVmPromises: Promise<any>[] = [];
        for (var vm of listOfVms) {
            var vmName = vm["name"];
            var resourceGroupName = this.taskParameters.resourceGroupName;
            var extensionParameters = this._formExtensionParameters(vm, operationParameters.operation);
            var extensionName = extensionParameters["extensionName"];
            this.log(tl.loc("DeleteExtension", extensionName, vmName));
            deleteExtensionFromVmPromises.push(this.deleteMGExtension(vm, operationParameters));
        }
        await Promise.all(deleteExtensionFromVmPromises);
        this.finalizeResult(operationParameters);
    }

    public deleteMGExtension(virtualMachine, operationParameters: OperationParameters): Promise<any> {
        return new Promise((resolve, reject) => {
            var vmName = virtualMachine["name"]
            var resourceGroupName = this.taskParameters.resourceGroupName;
            var extensionParameters = this._formExtensionParameters(virtualMachine, operationParameters.operation);
            var extensionName = extensionParameters["extensionName"];
            var callback = this._getPostOperationCallBack(operationParameters, extensionName, vmName, resolve, reject);
            this.computeClient.virtualMachineExtensions.deleteMethod(resourceGroupName, vmName, extensionName, callback);
        });
    }

    private getVmInstanceView(resourceGroupName, vmName, object, operationParameters): Promise<az.VM> {
        return new Promise((resolve, reject) => {
            var getVmInstanceViewCallback = (error, result, request, response) => {
                if (error) {
                    var errMsg = tl.loc("VMDetailsFetchFailedSkipExtensionOperation", vmName, operationParameters.operation);
                    this.log(errMsg);
                    reject(errMsg);
                }
                else if (result) {
                    resolve(result);
                }
            }
            this.computeClient.virtualMachines.get(resourceGroupName, vmName, object, getVmInstanceViewCallback);
        });
    }

    private finalizeResult(operationParameters) {
        if (operationParameters.failureCount + operationParameters.successCount === operationParameters.vmCount) {
            if (operationParameters.failureCount > 0) {
                var errMsg = tl.loc("MGAgentOperationOnAllVMsFailed", operationParameters.operation, "");
                this.log(errMsg);
                Promise.reject(errMsg);
            }
            else {
                if (operationParameters.vmCount !== 0) {
                    this.log(tl.loc("MGAgentOperationOnAllVMsSucceeded", operationParameters.operation));
                }
            }
        }
    }

    private startVmAndInstallExtension(operationParameters, vmName, extensionName, parameters): Promise<any> {
        return new Promise((resolve, reject) => {
            var invokeCreateOrUpdate = (error, result, request, response) => {
                if (error) {
                    this.log(tl.loc("VMStartFailedSkipExtensionOperation", vmName, operationParameters.operation, extensionName));
                    reject("error");
                }
                else if (result) {
                    var callback = this._getPostOperationCallBack(operationParameters, extensionName, vmName, resolve, reject);
                    this.computeClient.virtualMachineExtensions.createOrUpdate(this.taskParameters.resourceGroupName, vmName, extensionName, parameters, callback);
                }
            }
            this.computeClient.virtualMachines.start(this.taskParameters.resourceGroupName, vmName, invokeCreateOrUpdate);
        });
    }

    private installExtensionOnRunningVm(operationParameters, vmName, extensionName, parameters): Promise<any> {
        return new Promise((resolve, reject) => {
            var callback = this._getPostOperationCallBack(operationParameters, extensionName, vmName, resolve, reject);
            this.computeClient.virtualMachineExtensions.createOrUpdate(this.taskParameters.resourceGroupName, vmName, extensionName, parameters, callback);
        })
    }

    private _getPostOperationCallBack(operationParameters, extensionName, vmName, resolve, reject) {
        var postOperationCallBack = (error, result?, request?, response?) => {
            if (error) {
                operationParameters.failureCount++;
                operationParameters.errors += error.message;
                operationParameters.errors += "\n";
                var msg = tl.loc("OperationFailed", operationParameters.operation, extensionName, vmName);
                this.log(msg);
                reject(msg);
            } else {
                operationParameters.successCount++;
                msg = tl.loc("OperationSucceeded", operationParameters.operation, extensionName, vmName);
                this.log(msg);
                resolve(msg);
            }
        }
        return postOperationCallBack;
    }



    private _formExtensionParameters(virtualMachine, operation) {
        var vmId = virtualMachine["id"];
        var vmName = virtualMachine["name"];
        this.log("virtual machine : " + vmName);
        var vmOsType = virtualMachine["properties"]["storageProfile"]["osDisk"]["osType"];
        this.log("Operating system on virtual machine : " + vmOsType);
        var vmLocation = virtualMachine["location"];
        if (vmOsType === "Windows") {
            var extensionName = this.constants.mgExtensionNameWindows;
            var virtualMachineExtensionType: string = this.constants.vmExtensionTypeWindows;
            var typeHandlerVersion: string = this.constants.version;
        }
        else if (vmOsType === "Linux") {
            extensionName = this.constants.mgExtensionNameLinux;
            virtualMachineExtensionType = this.constants.vmExtensionTypeLinux;
            typeHandlerVersion = this.constants.version;
        }
        this.log(tl.loc("MGAgentHandlerMajorVersion", typeHandlerVersion.split(".")[0]));
        if (operation === "installation") {
            var autoUpgradeMinorVersion: boolean = true;
            var publisher: string = this.constants.publisher;
            var extensionType: string = this.constants.extensionType;
            if (this.taskParameters.CollectionUrlForMachineGroupAgentConfiguration) {
                var collectionUri = this.taskParameters.CollectionUrlForMachineGroupAgentConfiguration;
            }
            else {
                collectionUri = tl.getVariable('system.TeamFoundationCollectionUri');
            }
            if (this.taskParameters.ProjectNameForMachineGroupAgentConfiguration) {
                var teamProject = this.taskParameters.ProjectNameForMachineGroupAgentConfiguration;
            }
            else {

                teamProject = tl.getVariable('system.teamProject');
            }
            var uriLength = collectionUri.length;
            if (collectionUri[uriLength - 1] === '/') {
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
            console.log("Public settings are:\n VSTSAccountName: %s\nTeamProject: %s\nMachineGroup: %s\nTags: %s\n", collectionUri, teamProject, this.taskParameters.machineGroupName, tags);
            var protectedSettings = { PATToken: this.taskParameters.vstsPATToken };
            var parameters = {
                type: extensionType,
                location: vmLocation,
                properties: {
                    publisher: publisher,
                    type: virtualMachineExtensionType,
                    typeHandlerVersion: typeHandlerVersion,
                    autoUpgradeMinorVersion: autoUpgradeMinorVersion,
                    settings: publicSettings,
                    protectedSettings: protectedSettings
                }
            };
        }
        return { vmName: vmName, extensionName: extensionName, parameters: parameters };
    }

    private log(message) {
        tl.debug(message);
        console.log(message);
    }

}

export class OperationParameters {
    public failureCount: number;
    public successCount: number;
    public vmCount: number;
    public operation: string = "";

    constructor(operation) {
        this.successCount = 0;
        this.failureCount = 0;
        this.vmCount = 0;
        this.operation = operation;
        return this;
    }
}

export class Constants {
    publisher = "Microsoft.VisualStudio.Services";
    extensionType = "Microsoft.Compute/virtualMachines/extensions";
    mgExtensionNameWindows = "TeamServicesAgent";
    vmExtensionTypeWindows = "TeamServicesAgent";
    mgExtensionNameLinux = "TeamServicesAgentLinux";
    vmExtensionTypeLinux = "TeamServicesAgentLinux";
    version = "1.0";
    enablePrereqMG = "ConfigureVMWithMGAgent";
    enablePrereqWinRM = "ConfigureVMwithWinRM"
    enablePrereqNone = "None";
}