import computeManagementClient = require("./azure-rest/azure-arm-compute");
import util = require("util");
import tl = require("vsts-task-lib/task");
import azure_utils = require("./AzureUtil");
import deployAzureRG = require("../models/DeployAzureRG");
import constants = require("./Constants");

export class MachineGroupExtensionHelper {
    private _taskParameters: deployAzureRG.AzureRGTaskParameters;
    private _azureUtils: azure_utils.AzureUtil;
    private _computeClient;

    constructor(taskParameters: deployAzureRG.AzureRGTaskParameters) {
        this._taskParameters = taskParameters;
        this._computeClient = new computeManagementClient.ComputeManagementClient(this._taskParameters.credentials, this._taskParameters.subscriptionId);
        this._azureUtils = new azure_utils.AzureUtil(this._taskParameters, this._computeClient);
    }
    public async installExtension() {
        var operationParameters = new OperationParameters("installation");
        var listOfVms = await this._azureUtils.getVMDetails();
        var vmInstanceViewPromises: Promise<any>[] = [];
        operationParameters.vmCount = listOfVms.length;
        for (var vm of listOfVms) {
            var vmName = vm["name"];
            var resourceGroupName = this._taskParameters.resourceGroupName;
            vmInstanceViewPromises.push(this.getVmInstanceView(resourceGroupName, vmName, { expand: 'instanceView' }, operationParameters));
        }
        var vmInstanceViews = await Promise.all(vmInstanceViewPromises);

        var installExtensionOnVmPromises: Promise<any>[] = [];
        for (var vm of vmInstanceViews) {
            var extensionParameters = this._formExtensionParameters(vm, operationParameters.operation);
            var extensionName = extensionParameters["extensionName"];
            var parameters = extensionParameters["parameters"];
            var statuses = vm["properties"]["instanceView"]["statuses"];
            for (var i = 0; i < statuses.length; i++) {
                var status = statuses[i]["code"].split("/");
                if (status.length > 1 && status[0] === "PowerState") {
                    if (status[1] === "running") {
                        this.log(tl.loc("AddExtension", extensionName, vmName));
                        installExtensionOnVmPromises.push(this.installExtensionOnRunningVm(operationParameters, vmName, extensionName, parameters));
                    }
                    else if (status[1] === "deallocated") {
                        installExtensionOnVmPromises.push(this.startVmAndInstallExtension(operationParameters, vmName, extensionName, parameters));
                    }
                    else {
                        this.log(tl.loc("VMTransitioningSkipExtensionOperation", vmName, operationParameters.operation, extensionName));
                        var callback = this._getPostOperationCallBack(operationParameters, extensionName, vmName, Promise.resolve, Promise.reject);
                        callback("error");
                    }
                    break;
                }
            }
        }
        await Promise.all(installExtensionOnVmPromises);
        this.finalizeResult(operationParameters);
    }

    public async deleteMGExtensionRG(): Promise<void> {
        var operationParameters = new OperationParameters("uninstallation");
        var listOfVms = await this._azureUtils.getVMDetails();
        operationParameters.vmCount = listOfVms.length;
        var deleteExtensionFromVmPromises: Promise<any>[] = [];
        for (var vm of listOfVms) {
            var vmName = vm["name"];
            var resourceGroupName = this._taskParameters.resourceGroupName;
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
            var resourceGroupName = this._taskParameters.resourceGroupName;
            var extensionParameters = this._formExtensionParameters(virtualMachine, operationParameters.operation);
            var extensionName = extensionParameters["extensionName"];
            var callback = this._getPostOperationCallBack(operationParameters, extensionName, vmName, resolve, reject);
            this._computeClient.virtualMachineExtensions.deleteMethod(resourceGroupName, vmName, extensionName, callback);
        });
    }

    private finalizeResult(operationParameters) {
        if (operationParameters.failureCount + operationParameters.successCount === operationParameters.vmCount) {
            if (operationParameters.failureCount > 0) {
                var errMsg = tl.loc("MGAgentOperationOnAllVMsFailed", operationParameters.operation, "");
                this.log(errMsg);
                throw (errMsg);
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
                    var callback = this._getPostOperationCallBack(operationParameters, extensionName, vmName, resolve, reject);
                    callback("error");
                }
                else if (result) {
                    var callback = this._getPostOperationCallBack(operationParameters, extensionName, vmName, resolve, reject);
                    this._computeClient.virtualMachineExtensions.createOrUpdate(this._taskParameters.resourceGroupName, vmName, extensionName, parameters, callback);
                }
            }
            this._computeClient.virtualMachines.start(this._taskParameters.resourceGroupName, vmName, invokeCreateOrUpdate);
        });
    }

    private installExtensionOnRunningVm(operationParameters, vmName, extensionName, parameters): Promise<any> {
        return new Promise((resolve, reject) => {
            var callback = this._getPostOperationCallBack(operationParameters, extensionName, vmName, resolve, reject);
            this._computeClient.virtualMachineExtensions.createOrUpdate(this._taskParameters.resourceGroupName, vmName, extensionName, parameters, callback);
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
                resolve(msg);
            } else {
                operationParameters.successCount++;
                msg = tl.loc("OperationSucceeded", operationParameters.operation, extensionName, vmName);
                this.log(msg);
                resolve(msg);
            }
        }
        return postOperationCallBack;
    }

    private getVmInstanceView(resourceGroupName, vmName, object, operationParameters): Promise<any> {
        return new Promise((resolve, reject) => {
            var getVmInstanceViewCallback = (error, result, request, response) => {
                if (result) {
                    resolve(result);
                }
                else if (error) {
                    var errMsg = tl.loc("VMDetailsFetchFailedSkipExtensionOperation", vmName, operationParameters.operation);
                    this.log(errMsg);
                    resolve(errMsg);
                }
            }
            this._computeClient.virtualMachines.get(resourceGroupName, vmName, object, getVmInstanceViewCallback);
        });
    }

    private _formExtensionParameters(virtualMachine, operation) {
        var vmId = virtualMachine["id"];
        var vmName = virtualMachine["name"];
        this.log("virtual machine : " + vmName);
        var vmOsType = virtualMachine["properties"]["storageProfile"]["osDisk"]["osType"];
        this.log("Operating system on virtual machine : " + vmOsType);
        var vmLocation = virtualMachine["location"];
        if (vmOsType === "Windows") {
            var extensionName = constants.mgExtensionNameWindows;
            var virtualMachineExtensionType: string = constants.vmExtensionTypeWindows;
            var typeHandlerVersion: string = constants.version;
        }
        else if (vmOsType === "Linux") {
            extensionName = constants.mgExtensionNameLinux;
            virtualMachineExtensionType = constants.vmExtensionTypeLinux;
            typeHandlerVersion = constants.version;
        }
        this.log(tl.loc("MGAgentHandlerMajorVersion", typeHandlerVersion.split(".")[0]));
        if (operation === "installation") {
            var autoUpgradeMinorVersion: boolean = true;
            var publisher: string = constants.publisher;
            var extensionType: string = constants.extensionType;
            if (this._taskParameters.__mg__internal__collection__uri) {
                var collectionUri = this._taskParameters.__mg__internal__collection__uri;
            }
            else {
                collectionUri = tl.getVariable('system.TeamFoundationCollectionUri');
            }
            if (this._taskParameters.__mg__internal__project__name) {
                var teamProject = this._taskParameters.__mg__internal__project__name;
            }
            else {

                teamProject = tl.getVariable('system.teamProject');
            }
            var uriLength = collectionUri.length;
            if (collectionUri[uriLength - 1] === '/') {
                collectionUri = collectionUri.substr(0, uriLength - 1);
            }
            var tags = "";
            if (virtualMachine["tags"] && this._taskParameters.copyAzureVMTags) {
                this.log("Copying VM tags")
                tags = virtualMachine["tags"];
            }
            var publicSettings = {
                VSTSAccountName: collectionUri,
                TeamProject: teamProject,
                MachineGroup: this._taskParameters.machineGroupName,
                AgentName: "",
                Tags: tags
            };
            this.log(tl.loc("PublicSettings", collectionUri, teamProject, this._taskParameters.machineGroupName, tags));
            var protectedSettings = { PATToken: this._taskParameters.vstsPATToken };
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