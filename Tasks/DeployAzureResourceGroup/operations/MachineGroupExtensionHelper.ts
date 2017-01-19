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

    public async installExtensionOnResourceGroup() {
        console.log("Installing Vistual studio agent on the virutal machines.");
        var listOfVms: az.VM[] = await this.azureUtils.getVMDetails();
        var extensionInstalledOnVMsPromises: Promise<any>[] = [];
        for (var vm of listOfVms) {
            var vmName: string = vm.name;
            extensionInstalledOnVMsPromises.push(this.installExtensionOnSingleVM(vmName));
        }
        await Promise.all(extensionInstalledOnVMsPromises);
        if (listOfVms.length > 0) {
            console.log(tl.loc("MGAgentOperationOnAllVMsSucceeded"));
        }
    }

    public async deleteExtensionOnResourceGroup(): Promise<void> {
        console.log("Installing Vistual studio agent on the virutal machines.");
        var listOfVms: az.VM[] = await this.azureUtils.getVMDetails();
        var deleteExtensionFromVmPromises: Promise<any>[] = [];
        for (var vm of listOfVms) {
            console.log(tl.loc("DeleteExtension", vm.name));
            deleteExtensionFromVmPromises.push(this.deleteExtension(vm));
        }
        await Promise.all(deleteExtensionFromVmPromises);
        if (listOfVms.length > 0) {
            console.log(tl.loc("MGAgentOperationOnAllVMsSucceeded"));
        }
    }

    public deleteExtension(virtualMachine: az.VM): Promise<any> {
        var operation = "uninstallation";
        return new Promise((resolve, reject) => {
            var vmName = virtualMachine["name"]
            var resourceGroupName = this.taskParameters.resourceGroupName;
            var extensionParameters = this.formExtensionParameters(virtualMachine, operation);
            var extensionName = extensionParameters["extensionName"];
            var callback = this.getPostOperationCallBack(operation, extensionName, vmName, resolve, reject);
            this.computeClient.virtualMachineExtensions.deleteMethod(resourceGroupName, vmName, extensionName, callback);
        });
    }

    private async installExtensionOnSingleVM(vmName: string) {
        var resourceGroupName: string = this.taskParameters.resourceGroupName;
        var vmInstanceView: az.VM = await this.getVmInstanceView(resourceGroupName, vmName, { expand: 'instanceView' }, operation);
        var powerState = this.getVMPowerState(vmInstanceView);
        if (powerState === "deallocated") {
            await this.startVirtualMachine(vmName);
            powerState = "running";
        }
        if (powerState === "running") {
            await this.installExtensionOnRunningVm(vmInstanceView);
        }
        else {
            throw Error("virtual machine <>: is in state: <>. Extension cannot be installed");
        }
    }

    private getVMPowerState(vm: az.VM): string {
        for (var status of vm.properties.instanceView.statuses) {
            if (status["code"]) {
                var properties = status["code"].split("/");
                if (properties.length > 1 && properties[0] === "PowerState") {
                    return properties[1];
                }
            }
        }

        return null;
    }

    private getVmInstanceView(resourceGroupName, vmName, object, operation): Promise<az.VM> {
        return new Promise((resolve, reject) => {
            var getVmInstanceViewCallback = (error, result, request, response) => {
                if (error) {
                    var errMsg = tl.loc("VMDetailsFetchFailedSkipExtensionOperation", vmName, operation, utils.getError(error));
                    reject(errMsg);
                }
                resolve(result);
            }
            this.computeClient.virtualMachines.get(resourceGroupName, vmName, object, getVmInstanceViewCallback);
        });
    }

    private startVirtualMachine(vmName) {
        return new Promise((resolve, reject) => {
            this.computeClient.virtualMachines.start(this.taskParameters.resourceGroupName, vmName, (error, result) => {
                if (error) {
                    reject (tl.loc("VMStartFailedSkipExtensionOperation", utils.getError(error)));
                }

                resolve();
            });
        });
    }

    private installExtensionOnRunningVm(vmInstanceView: az.VM): Promise<any> {
        var operation: string = "installation";
        var extensionParameters = this.formExtensionParameters(vmInstanceView, operation);
        var extensionName = extensionParameters["extensionName"];
        var parameters = extensionParameters["parameters"];
        return new Promise((resolve, reject) => {
            var callback = this.getPostOperationCallBack(operation, extensionName, vmInstanceView.name, resolve, reject);
            this.computeClient.virtualMachineExtensions.createOrUpdate(this.taskParameters.resourceGroupName, vmInstanceView.name, extensionName, parameters, callback);
        })
    }

    private getPostOperationCallBack(operation, extensionName, vmName, resolve, reject) {
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

    private formExtensionParameters(virtualMachine: az.VM, operation) {
        var vmId = virtualMachine.id;
        var vmName = virtualMachine.name;
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