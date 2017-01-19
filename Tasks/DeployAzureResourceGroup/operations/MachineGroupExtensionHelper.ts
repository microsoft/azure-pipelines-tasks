import computeManagementClient = require("./azure-rest/azure-arm-compute");
import util = require("util");
import tl = require("vsts-task-lib/task");
import azure_utils = require("./AzureUtil");
import deployAzureRG = require("../models/DeployAzureRG");
import az = require("./azure-rest/azureModels");
import utils = require("./Utils");

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
        var operation: string = "installation";
        var listOfVms: az.VM[] = await this.azureUtils.getVMDetails();
        var extensionInstalledOnVMsPromises: Promise<any>[] = [];
        extensionInstalledOnVMsPromises.push(this.installExtensionOnSingleVM(operation, listOfVms));
        await Promise.all(extensionInstalledOnVMsPromises);
        if (listOfVms.length > 0) {
            console.log(tl.loc("MGAgentOperationOnAllVMsSucceeded", operation));
        }
    }

    private async installExtensionOnSingleVM(operation, listOfVms) {
        for (var vm of listOfVms) {
            var vmName: string = vm.name;
            var resourceGroupName: string = this.taskParameters.resourceGroupName;
            var vmInstanceView: az.VM = await this.getVmInstanceView(resourceGroupName, vmName, { expand: 'instanceView' }, operation);
            var extensionParameters = this._formExtensionParameters(vm, operation);
            var extensionName = extensionParameters["extensionName"];
            var parameters = extensionParameters["parameters"];
            var statuses = vmInstanceView.properties.instanceView.statuses;
            for (var i = 0; i < statuses.length; i++) {
                var status = statuses[i]["code"].split("/");
                if (status.length > 1 && status[0] === "PowerState") {
                    if (status[1] === "running") {
                        console.log(tl.loc("AddExtension", extensionName, vmName));
                        await this.installExtensionOnRunningVm(operation, vmName, extensionName, parameters);
                    }
                    else if (status[1] === "deallocated") {
                        await this.startVmAndInstallExtension(operation, vmName, extensionName, parameters);
                    }
                    else {
                        var errMsg = tl.loc("VMTransitioningSkipExtensionOperation", vmName, operation, extensionName);
                        console.log(errMsg);
                        await Promise.reject(errMsg);
                    }
                    break;
                }
            }
        }
    }

    public async deleteMGExtensionRG(): Promise<void> {
        var operation = "uninstallation";
        var listOfVms: az.VM[] = await this.azureUtils.getVMDetails();
        var deleteExtensionFromVmPromises: Promise<any>[] = [];
        for (var vm of listOfVms) {
            var vmName = vm["name"];
            var resourceGroupName = this.taskParameters.resourceGroupName;
            var extensionParameters = this._formExtensionParameters(vm, operation);
            var extensionName = extensionParameters["extensionName"];
            console.log(tl.loc("DeleteExtension", extensionName, vmName));
            deleteExtensionFromVmPromises.push(this.deleteMGExtension(vm, operation));
        }
        await Promise.all(deleteExtensionFromVmPromises);
        if (listOfVms.length > 0) {
            console.log(tl.loc("MGAgentOperationOnAllVMsSucceeded", operation));
        }
    }

    public deleteMGExtension(virtualMachine: az.VM, operation): Promise<any> {
        return new Promise((resolve, reject) => {
            var vmName = virtualMachine["name"]
            var resourceGroupName = this.taskParameters.resourceGroupName;
            var extensionParameters = this._formExtensionParameters(virtualMachine, operation);
            var extensionName = extensionParameters["extensionName"];
            var callback = this._getPostOperationCallBack(operation, extensionName, vmName, resolve, reject);
            this.computeClient.virtualMachineExtensions.deleteMethod(resourceGroupName, vmName, extensionName, callback);
        });
    }

    private getVmInstanceView(resourceGroupName, vmName, object, operation): Promise<az.VM> {
        return new Promise((resolve, reject) => {
            var getVmInstanceViewCallback = (error, result, request, response) => {
                if (error) {
                    var errMsg = tl.loc("VMDetailsFetchFailedSkipExtensionOperation", vmName, operation, utils.getError(error));
                    console.log(errMsg);
                    reject(errMsg);
                }
                else if (result) {
                    resolve(result);
                }
            }
            this.computeClient.virtualMachines.get(resourceGroupName, vmName, object, getVmInstanceViewCallback);
        });
    }

    private startVmAndInstallExtension(operation, vmName, extensionName, parameters): Promise<any> {
        return new Promise((resolve, reject) => {
            var invokeCreateOrUpdate = (error, result, request, response) => {
                if (error) {
                    var errMsg = tl.loc("VMStartFailedSkipExtensionOperation", vmName, operation, extensionName, utils.getError(error));
                    console.log(errMsg);
                    reject(errMsg);
                }
                else if (result) {
                    var callback = this._getPostOperationCallBack(operation, extensionName, vmName, resolve, reject);
                    this.computeClient.virtualMachineExtensions.createOrUpdate(this.taskParameters.resourceGroupName, vmName, extensionName, parameters, callback);
                }
            }
            this.computeClient.virtualMachines.start(this.taskParameters.resourceGroupName, vmName, invokeCreateOrUpdate);
        });
    }

    private installExtensionOnRunningVm(operation, vmName, extensionName, parameters): Promise<any> {
        return new Promise((resolve, reject) => {
            var callback = this._getPostOperationCallBack(operation, extensionName, vmName, resolve, reject);
            this.computeClient.virtualMachineExtensions.createOrUpdate(this.taskParameters.resourceGroupName, vmName, extensionName, parameters, callback);
        })
    }

    private _getPostOperationCallBack(operation, extensionName, vmName, resolve, reject) {
        var postOperationCallBack = (error, result?, request?, response?) => {
            if (error) {
                var msg = tl.loc("OperationFailed", operation, extensionName, vmName, utils.getError(error));
                console.log(msg);
                reject(msg);
            } 
            else {
                msg = tl.loc("OperationSucceeded", operation, extensionName, vmName);
                console.log(msg);
                resolve(msg);
            }
        }
        return postOperationCallBack;
    }



    private _formExtensionParameters(virtualMachine: az.VM, operation) {
        var vmId = virtualMachine["id"];
        var vmName = virtualMachine["name"];
        console.log("virtual machine : " + vmName);
        var vmOsType = virtualMachine["properties"]["storageProfile"]["osDisk"]["osType"];
        console.log("Operating system on virtual machine : " + vmOsType);
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
        console.log(tl.loc("MGAgentHandlerMajorVersion", typeHandlerVersion.split(".")[0]));
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
                console.log("Copying VM tags")
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