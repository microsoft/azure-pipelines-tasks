import validateInputs = require("./ValidateInputs");
import azureStorage = require('azure-storage');
import StorageAccountModel = require("../models/StorageAccountModel");
import azure_utils = require("./AzureUtil");
import az = require("azure-arm-rest/azureModels");
import computeManagementClient = require("azure-arm-rest/azure-arm-compute");

export class VirtualMachine {
    private taskParameters: validateInputs.AzureFileCopyXplatTaskParameters;
    private azureUtils: azure_utils.AzureUtil;
    private publisherWin = "Microsoft.Compute";
    private publisherLinux = "Microsoft.Azure.Extensions";
    private extensionType = "Microsoft.Compute/virtualMachines/extensions";
    private extensionNameWindows = "CustomScriptExtension";
    private extensionTypeWindows = "CustomScriptExtension";
    private extensionNameLinux = "CustomScript";
    private extensionTypeLinux = "CustomScript";
    private scriptsDir = "Scripts"
    private windowsScriptName = "FetchBlobScriptWindows.ps1";
    private linuxScriptName = "FetchBlobScriptLinux.py";
    private versionWin = "1.9";
    private versionLinux = "2.0"
    private computeClient: computeManagementClient.ComputeManagementClient;
    private storageAcountModel: StorageAccountModel.StorageAccount;
    private storageAccountKey: string;
    private blobSvc: azureStorage.BlobService;
    constructor(taskParameters: validateInputs.AzureFileCopyXplatTaskParameters) {
        this.taskParameters = taskParameters;
        this.computeClient = new computeManagementClient.ComputeManagementClient(this.taskParameters.armCredentials, this.taskParameters.subscriptionId);
        this.azureUtils = new azure_utils.AzureUtil(this.taskParameters, this.computeClient);
        this.storageAcountModel = new StorageAccountModel.StorageAccount(taskParameters);
        let storageAccount: StorageAccountModel.StorageAccountInfo = await this.storageAcountModel._getStorageAccountDetails();
        this.storageAccountKey = storageAccount.primaryAccessKey;
        this.blobSvc = azureStorage.createBlobService(storageAccount.name, storageAccount.primaryAccessKey);
    }

    public async copyFromBlobFilesToVMs(taskParameters): Promise<void> {
        // might need to get storage key for cse
        // execute cse on the arm vms windows/linux
    }

    public async addExtensionOnResourceGroup(): Promise<any> {
        console.log(tl.loc("InstallingCSEOnVMs"));
        var listOfVms: az.VM[] = await this.azureUtils.getVMDetails();
        var extensionAddedOnVMsPromises: Promise<any>[] = [];
        for (var vm of listOfVms) {
            extensionAddedOnVMsPromises.push(this.addExtensionOnSingleVM(vm));
        }
        await Promise.all(extensionAddedOnVMsPromises);
        if (listOfVms.length > 0) {
            console.log(tl.loc("CSEAddedOnAllVMs"));
        }
    }

    private async addExtensionOnSingleVM(vm: az.VM): Promise<any> {
        var vmName = vm.name;
        var operation = "add";
        var vmWithInstanceView: az.VM = await this.getVmWithInstanceView(this.taskParameters.resourceGroupName, vmName, { expand: 'instanceView' });
        var vmPowerState = this.getVMPowerState(vmWithInstanceView);
        if (vmPowerState === "deallocated") {
            await this.startVirtualMachine(vmName);
            vmPowerState = "running";
        }
        if (vmPowerState === "running") {
            await this.addExtensionOnRunningVm(vm);
        }
        else {
            throw new Error(tl.loc("VMTransitioningSkipExtensionAddition", vmName));
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

    private getVmWithInstanceView(resourceGroupName, vmName, object): Promise<az.VM> {
        return new Promise((resolve, reject) => {
            var getVmWithInstanceViewCallback = (error, result, request, response) => {
                if (error) {
                    return reject(tl.loc("VMDetailsFetchFailed", vmName, error));
                }
                console.log(tl.loc("VMDetailsFetchSucceeded", vmName));
                resolve(result);
            }
            this.computeClient.virtualMachines.get(resourceGroupName, vmName, object, getVmWithInstanceViewCallback);
        });
    }

    private startVirtualMachine(vmName: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.computeClient.virtualMachines.start(this.taskParameters.resourceGroupName, vmName, async (error, result, request, response) => {
                if (error) {
                    console.log(error);
                    var isVMRunning = false;
                    try {
                        var vmWithInstanceView: az.VM = await this.getVmWithInstanceView(this.taskParameters.resourceGroupName, vmName, { expand: 'instanceView' });
                        var vmPowerState = this.getVMPowerState(vmWithInstanceView);
                        if (vmPowerState === "running") {
                            isVMRunning = true;
                        }
                    }
                    catch (exception) {
                        tl.warning(exception);
                    }
                    if (!isVMRunning) {
                        return reject(tl.loc("VMStartFailed", vmName, error));
                    }
                }
                console.log(tl.loc("VMStarted", vmName));
                resolve(result);
            });
        });
    }

    private async tryDeleteFailedExtension(vm: az.VM): Promise<any> {
        try {
            await this.deleteExtensionFromSingleVM(vm);
        }
        catch (exception) {
            tl.warning(exception);
        }
    }

    public deleteExtensionFromSingleVM(vm: az.VM): Promise<any> {
        return new Promise((resolve, reject) => {
            var vmName = vm["name"];
            var extensionParameters = this.formExtensionParameters(vm, "delete");
            var extensionName = extensionParameters["extensionName"];
            console.log(tl.loc("DeleteExtension", extensionName, vmName));
            this.computeClient.virtualMachineExtensions.deleteMethod(this.taskParameters.resourceGroupName, vmName, az.ComputeResourceType.VirtualMachine, extensionName, (error, result, request, response) => {
                if (error) {
                    tl.warning(tl.loc("DeleteAgentManually", vmName));
                    return reject(tl.loc("DeletionFailed", vmName, error));
                }
                console.log(tl.loc("DeletionSucceeded", vmName));
                resolve();
            });
        });
    }

    private addExtensionOnRunningVm(vm: az.VM): Promise<any> {
        return new Promise((resolve, reject) => {
            var vmName = vm.name;
            var extensionParameters = this.formExtensionParameters(vm, "add");
            var extensionName = extensionParameters["extensionName"];
            var parameters = extensionParameters["parameters"];
            this.computeClient.virtualMachineExtensions.get(this.taskParameters.resourceGroupName, vmName, az.ComputeResourceType.VirtualMachine, extensionName, null, async (error, result: az.VMExtension, request, response) => {
                if (result && result.properties.provisioningState === "Failed") {
                    await this.tryDeleteFailedExtension(vm);
                }
                console.log(tl.loc("AddExtension", extensionName, vmName));
                this.computeClient.virtualMachineExtensions.createOrUpdate(this.taskParameters.resourceGroupName, vmName, az.ComputeResourceType.VirtualMachine, extensionName, parameters, async (error, result, request, response) => {
                    if (error) {
                        console.log(tl.loc("AddingExtensionFailed", extensionName, vmName, error));
                        await this.tryDeleteFailedExtension(vm);
                        return reject(tl.loc("CSEInstallationOnAllVMsFailed"));
                    }
                    console.log(tl.loc("AddingExtensionSucceeded", extensionName, vmName));
                    resolve();
                });
            });
        })
    }

    private formExtensionParameters(vm: az.VM, operation): { vmName: string, extensionName: string, parameters: Object } {
        var vmId = vm.id;
        var vmName = vm.name;
        console.log("virtual machine : " + vmName);
        var vmOsType = vm.properties.storageProfile.osDisk.osType;
        console.log("Operating system on virtual machine : " + vmOsType);
        var vmLocation = vm.location;
        var start: Date = new Date();
        var expiry: Date = new Date();
        expiry.setTime(expiry.getTime() + 60 * 60 * 1000);
        var accessPolicy: azureStorage.AccessPolicy = {
            Permissions: "READ",
            Start: start,
            Expiry: expiry,
            Services: "BLOB",
            ResourceTypes: "BLOB"
        }
        var sharedAccessPolicy: azureStorage.SharedAccessPolicy = {
            AccessPolicy: accessPolicy
        }
        if (vmOsType === "Windows") {
            var publisher: string = this.publisherWin;
            var extensionName = this.extensionNameWindows;
            var virtualMachineExtensionType: string = this.extensionTypeWindows;
            var typeHandlerVersion: string = this.versionWin;
            var sasToken = this.blobSvc.generateSharedAccessSignature(this.taskParameters.containerName, this.scriptsDir + '/' + this.windowsScriptName);
            var publicSettings = {
                fileUris: [
                    `https://${this.taskParameters.storageAccount}.blob.core.windows.net/${this.taskParameters.containerName}/${this.scriptsDir + '/' + this.windowsScriptName}`
                ]
            };
            var protectedSettings = {
                commandToExecute: `powershell.exe .\\${this.scriptsDir}\\${this.windowsScriptName} -storageAccountName ${this.taskParameters.storageAccount} -containerName ${this.taskParameters.containerName} -sasToken ${sasToken} -path ${this.taskParameters.targetPathWin}`,
                storageAccountName: `${this.taskParameters.storageAccount}`,
                storageAccountKey: `${this.storageAccountKey}`
            };
        }
        else if (vmOsType === "Linux") {
            publisher = this.publisherLinux;
            extensionName = this.extensionNameLinux;
            virtualMachineExtensionType = this.extensionTypeLinux;
            typeHandlerVersion = this.versionLinux;
            var sasToken = this.blobSvc.generateSharedAccessSignature(this.taskParameters.containerName, this.scriptsDir + '/' + this.linuxScriptName);
            publicSettings = {
                fileUris: [
                    `https://${this.taskParameters.storageAccount}.blob.core.windows.net/${this.taskParameters.containerName}/${this.scriptsDir + '/' + this.linuxScriptName}`
                ]
            };
            protectedSettings = {
                commandToExecute: `python ./${this.scriptsDir}/${this.linuxScriptName} ${this.taskParameters.storageAccount} ${this.taskParameters.containerName} ${sasToken} ${this.taskParameters.targetPathLinux}`,
                storageAccountName: `${this.taskParameters.storageAccount}`,
                storageAccountKey: `${this.storageAccountKey}`
            };
        }
        if (operation === "add") {
            var autoUpgradeMinorVersion: boolean = true;
            var extensionType: string = this.extensionType;
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
