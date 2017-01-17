import computeManagementClient = require("./azure-rest/azure-arm-compute");
import util = require("util");
import tl = require("vsts-task-lib/task");
import azure_utils = require("./AzureUtil");
import deployAzureRG = require("../models/DeployAzureRG");
import constants = require("./Constants");

export class MachineGroupAgentExtensionManager {
    private _taskParameters: deployAzureRG.AzureRGTaskParameters;
    private _credentials;
    private _subscriptionId: string;
    private _azureUtils: azure_utils.AzureUtil;
    private _computeClient;

    constructor(taskParameters: deployAzureRG.AzureRGTaskParameters) {
        this._taskParameters = taskParameters;
        this._credentials = this._taskParameters.credentials;
        this._subscriptionId = this._taskParameters.subscriptionId;
        this._computeClient = new computeManagementClient.ComputeManagementClient(this._credentials, this._subscriptionId);
        this._azureUtils = new azure_utils.AzureUtil(this._taskParameters, this._computeClient);
        return this;
    }
    public installMGExtension() {
        return new Promise((resolve, reject) => {
            var operationParameters = new OperationParameters("installation");
            var listOfVmsPromise = this._azureUtils.getVMDetails();
            listOfVmsPromise.then((listOfVms) => {
                operationParameters.vmCount = listOfVms.length;
                if (operationParameters.vmCount === 0) {
                    resolve("");
                }
                for (var i = 0; i < listOfVms.length; i++) {
                    var vmName = listOfVms[i]["name"];
                    var resourceGroupName = this._taskParameters.resourceGroupName;
                    var extensionParameters = this._formExtensionParameters(listOfVms[i], operationParameters.operation);
                    var extensionName = extensionParameters["extensionName"];
                    var parameters = extensionParameters["parameters"];
                    var callback = this._getPostOperationCallBack(operationParameters, extensionName, vmName, resolve, reject);
                    var installMGExtensionCallback = this._getInstallMGExtensionCallback(operationParameters, extensionName, vmName, parameters, callback);
                    this._computeClient.virtualMachines.get(resourceGroupName, vmName, { expand: 'instanceView' }, installMGExtensionCallback);
                }
            });
        });
    }

    public deleteMGExtensionRG() {
        return new Promise((resolve, reject) => {
            var operationParameters = new OperationParameters("uninstallation");
            var listOfVmsPromise = this._azureUtils.getVMDetails();
            listOfVmsPromise.then((listOfVms) => {
                operationParameters.vmCount = listOfVms.length;
                if (operationParameters.vmCount === 0) {
                    resolve("");
                }
                for (var i = 0; i < listOfVms.length; i++) {
                    var vmName = listOfVms[i]["name"];
                    var resourceGroupName = this._taskParameters.resourceGroupName;
                    var extensionParameters = this._formExtensionParameters(listOfVms[i], operationParameters.operation);
                    var extensionName = extensionParameters["extensionName"];
                    this.log(tl.loc("DeleteExtension", extensionName, vmName));
                    var callback = this._getPostOperationCallBack(operationParameters, extensionName, vmName, resolve, reject);
                    this._computeClient.virtualMachineExtensions.deleteMethod(resourceGroupName, vmName, extensionName, callback);
                }
            });
        });
    }

    public deleteMGExtension(virtualMachine) {
        return new Promise((resolve, reject) => {
            var operationParameters = new OperationParameters("uninstallation");
            var vmName = virtualMachine["name"]
            var resourceGroupName = this._taskParameters.resourceGroupName;
            var extensionParameters = this._formExtensionParameters(virtualMachine, operationParameters.operation);
            var extensionName = extensionParameters["extensionName"];
            var callback = (error, result, request, response) => {
                if (error) {
                    reject("");
                }
                else {
                    resolve("");
                }
            }
            this._computeClient.virtualMachineExtensions.deleteMethod(resourceGroupName, vmName, extensionName, callback);
        });
    }

    private _getPostOperationCallBack(operationParameters, extensionName, vmName, resolve, reject) {
        var postOperationCallBack = (error, result, request, response) => {
            if (error) {
                operationParameters.failureCount++;
                operationParameters.errors += error.message;
                operationParameters.errors += "\n";
                this.log(tl.loc("OperationFailed", operationParameters.operation, extensionName, vmName));
            } else {
                operationParameters.successCount++;
                this.log(tl.loc("OperationSucceeded", operationParameters.operation, extensionName, vmName));
            }
            if (operationParameters.failureCount + operationParameters.successCount === operationParameters.vmCount) {
                if (operationParameters.failureCount > 0) {
                    this.log(tl.loc("MGAgentOperationOnAllVMsFailed", operationParameters.operation, ""));
                    reject(operationParameters.operation);
                }
                else {
                    if (operationParameters.vmCount !== 0) {
                        this.log(tl.loc("MGAgentOperationOnAllVMsSucceeded", operationParameters.operation));
                    }
                    resolve(operationParameters.operation);
                }
            }
        }
        return postOperationCallBack;
    }

    private _getInstallMGExtensionCallback(operationParameters, extensionName, vmName, parameters, callback) {
        var installExtensionOnRunningVm = () => {
            this.log(tl.loc("AddExtension", extensionName, vmName));
            this._computeClient.virtualMachineExtensions.createOrUpdate(this._taskParameters.resourceGroupName, vmName, extensionName, parameters, callback);
        }
        var startVmAndInstallExtension = () => {
            var invokeCreateOrUpdate = (error, result, request, response) => {
                if (error) {
                    this.log(tl.loc("VMStartFailedSkipExtensionOperation", vmName, operationParameters.operation, extensionName));
                    callback("error");
                }
                else if (result) {
                    installExtensionOnRunningVm();
                }
            }
            this._computeClient.virtualMachines.start(this._taskParameters.resourceGroupName, vmName, invokeCreateOrUpdate);
        }
        var ceateOrUpdateCallBack = (error, result, request, response) => {
            if (result) {
                var statuses = result["properties"]["instanceView"]["statuses"];
                for (var i = 0; i < statuses.length; i++) {
                    var status = statuses[i]["code"].split("/");
                    if (status.length > 1 && status[0] === "PowerState") {
                        if (status[1] === "running") {
                            installExtensionOnRunningVm();
                        }
                        else if (status[1] === "deallocated") {
                            startVmAndInstallExtension();
                        }
                        else {
                            this.log(tl.loc("VMTransitioningSkipExtensionOperation", vmName, operationParameters.operation, extensionName));
                            callback("error");
                        }
                        break;
                    }
                }
            }
            else if (error) {
                this.log(tl.loc("VMDetailsFetchFailedSkipExtensioOperation", vmName, operationParameters.operation, extensionName));
                callback("error");
            }
        }
        return ceateOrUpdateCallBack;
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