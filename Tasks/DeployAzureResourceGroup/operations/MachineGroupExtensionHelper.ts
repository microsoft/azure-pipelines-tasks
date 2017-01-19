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
    private publisher = "Microsoft.VisualStudio.Services";
    private extensionType = "Microsoft.Compute/virtualMachines/extensions";
    private mgExtensionNameWindows = "TeamServicesAgent";
    private vmExtensionTypeWindows = "TeamServicesAgent";
    private mgExtensionNameLinux = "TeamServicesAgentLinux";
    private vmExtensionTypeLinux = "TeamServicesAgentLinux";
    private version = "1.0";

    constructor(taskParameters: deployAzureRG.AzureRGTaskParameters) {
        this.taskParameters = taskParameters;
        this.computeClient = new computeManagementClient.ComputeManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        this.azureUtils = new azure_utils.AzureUtil(this.taskParameters, this.computeClient);
    }

    public async installExtensionOnResourceGroup() {
        console.log("Installing machine group agent on the resource group virutal machines.");
        var listOfVms: az.VM[] = await this.azureUtils.getVMDetails();
        var extensionInstalledOnVMsPromises: Promise<any>[] = [];
        for (var vm of listOfVms) {
            extensionInstalledOnVMsPromises.push(this.installExtensionOnSingleVM(vm));
        }
        await Promise.all(extensionInstalledOnVMsPromises);
        if (listOfVms.length > 0) {
            console.log(tl.loc("MGAgentInstalledOnAllVMs"));
        }
    }

    private async installExtensionOnSingleVM(vm: az.VM) {
        var vmName = vm.name;
        var operation = "installation";
        var resourceGroupName = this.taskParameters.resourceGroupName;
        var vmWithInstanceView: az.VM = await this.getVmInstanceView(resourceGroupName, vmName, { expand: 'instanceView' });
        var vmPowerState = this.getVMPowerState(vmWithInstanceView);
        if (vmPowerState === "deallocated") {
            await this.startVirtualMachine(vmName);
            vmPowerState = "running";
        }
        if (vmPowerState === "running") {
            await this.installExtensionOnRunningVm(vm);
        }
        else {
            throw (tl.loc("VMTransitioningSkipExtensionInstallation", vmName));
        }
    }

    private getVMPowerState(vm: az.VM): string {
        var statuses = vm.properties.instanceView.statuses;
        for (var status of statuses) {
            if (status.code) {
                var properties = status.code.split("/");
                if (properties.length > 1 && properties[0] === "PowerState") {
                    return properties[1];
                }
            }
        }
        return null;
    }

    public async deleteMGExtensionFromResourceGroup(): Promise<void> {
        var listOfVms: az.VM[] = await this.azureUtils.getVMDetails();
        console.log("LIST OF VMS LENGTH IS " + listOfVms.length);
        var deleteExtensionFromVmPromises: Promise<any>[] = [];
        for (var vm of listOfVms) {
            deleteExtensionFromVmPromises.push(this.deleteMGExtension(vm));
        }
        await Promise.all(deleteExtensionFromVmPromises);
        if (listOfVms.length > 0) {
            console.log(tl.loc("MGAgentUninstalledFromAllVMs"));
        }
    }

    public deleteMGExtension(vm: az.VM): Promise<any> {
        return new Promise((resolve, reject) => {
            var vmName = vm["name"]
            var resourceGroupName = this.taskParameters.resourceGroupName;
            var extensionParameters = this.formExtensionParameters(vm, "uninstallation");
            var extensionName = extensionParameters["extensionName"];
            console.log(tl.loc("DeleteExtension", extensionName, vmName));
            this.computeClient.virtualMachineExtensions.deleteMethod(resourceGroupName, vmName, extensionName, (error, result, request, response) => {
                if (error) {
                    var errMsg = tl.loc("UninstallationFailed", vmName, utils.getError(error));
                    reject(errMsg);
                }
                console.log(tl.loc("UninstallationSucceeded", vmName));
                resolve();
            });
        });
    }

    private getVmInstanceView(resourceGroupName, vmName, object): Promise<az.VM> {
        return new Promise((resolve, reject) => {
            var getVmInstanceViewCallback = (error, result, request, response) => {
                if (error) {
                    var errMsg = tl.loc("VMDetailsFetchFailed", vmName, utils.getError(error));
                    reject(errMsg);
                }
                resolve(result);
            }
            this.computeClient.virtualMachines.get(resourceGroupName, vmName, object, getVmInstanceViewCallback);
        });
    }

    private startVirtualMachine(vmName: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.computeClient.virtualMachines.start(this.taskParameters.resourceGroupName, vmName, (error, result, request, response) => {
                if (error) {
                    var errMsg = tl.loc("VMStartFailed", vmName, utils.getError(error));
                    reject(errMsg);
                }
                resolve(result);
            });
        });
    }

    private installExtensionOnRunningVm(vm: az.VM): Promise<any> {
        return new Promise((resolve, reject) => {
            var vmName = vm.name;
            var extensionParameters = this.formExtensionParameters(vm, "installation");
            var extensionName = extensionParameters["extensionName"];
            var parameters = extensionParameters["parameters"];
            console.log(tl.loc("AddExtension", extensionName, vmName));
            this.computeClient.virtualMachineExtensions.createOrUpdate(this.taskParameters.resourceGroupName, vmName, extensionName, parameters, (error, result, request, response) => {
                if (error) {
                    var msg = tl.loc("InstallationFailed", extensionName, vmName, utils.getError(error));
                    reject(msg);
                }
                msg = tl.loc("InstallationSucceeded", extensionName, vmName);
                console.log(msg);
                resolve(msg);
            });
        })
    }

    private formExtensionParameters(vm: az.VM, operation) {
        var vmId = vm.id;
        var vmName = vm.name;
        console.log("virtual machine : " + vmName);
        var vmOsType = vm.properties.storageProfile.osDisk.osType;
        console.log("Operating system on virtual machine : " + vmOsType);
        var vmLocation = vm.location;
        if (vmOsType === "Windows") {
            var extensionName = this.mgExtensionNameWindows;
            var virtualMachineExtensionType: string = this.vmExtensionTypeWindows;
            var typeHandlerVersion: string = this.version;
        }
        else if (vmOsType === "Linux") {
            extensionName = this.mgExtensionNameLinux;
            virtualMachineExtensionType = this.vmExtensionTypeLinux;
            typeHandlerVersion = this.version;
        }
        console.log(tl.loc("MGAgentHandlerMajorVersion", typeHandlerVersion.split(".")[0]));
        if (operation === "installation") {
            var autoUpgradeMinorVersion: boolean = true;
            var publisher: string = this.publisher;
            var extensionType: string = this.extensionType;
            var collectionUri = this.taskParameters.MachineGroupCollectionUrl;
            var teamProject = this.taskParameters.MachineGroupAgentProjectName;
            var uriLength = collectionUri.length;
            if (collectionUri[uriLength - 1] === '/') {
                collectionUri = collectionUri.substr(0, uriLength - 1);
            }
            var tags = "";
            if (vm.tags && this.taskParameters.copyAzureVMTags) {
                console.log("Copying VM tags")
                tags = vm.tags;
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
