var computeManagementClient = require("./azure-arm-compute");
import util = require("util");
import tl = require("vsts-task-lib/task");
import azure_utils = require("./AzureUtil");
import deployAzureRG = require("./DeployAzureRG");
import Q = require("q");
import constants = require("./Constants");

export class MachineGroupAgentExtensionManager {
    private _taskParameters: deployAzureRG.AzureRGTaskParameters;
    private _credentials;
    private _subscriptionId: string;
    private _azureUtils;
    private _computeClient;

    constructor(taskParameters: deployAzureRG.AzureRGTaskParameters) {
        this._taskParameters = taskParameters;
        this._credentials = this._taskParameters.credentials;
        this._subscriptionId = this._taskParameters.subscriptionId;
        this._azureUtils = new azure_utils.AzureUtil(this._taskParameters);
        this._computeClient = new computeManagementClient.ComputeManagementClient(this._credentials, this._subscriptionId);
        return this;
    }
    public installMGExtension() {
        try {
            var operationParameters = new OperationParameters("installation");
            operationParameters.deferred = Q.defer<string>();
            var listOfVmsPromise = this._azureUtils.getVMDetails();
            listOfVmsPromise.then((listOfVms) => {
                operationParameters.vmCount = listOfVms.length;
                if (operationParameters.vmCount == 0) {
                    operationParameters.deferred.resolve("");
                }
                for (var i = 0; i < listOfVms.length; i++) {
                    var vmName = listOfVms[i]["name"];
                    var resourceGroupName = this._taskParameters.resourceGroupName;
                    var extensionParameters = this._formExtensionParameters(listOfVms[i], operationParameters.operation);
                    this.log(tl.loc("AddExtension", extensionParameters["extensionName"], vmName));
                    var extensionName = extensionParameters["extensionName"];
                    var parameters = extensionParameters["parameters"];
                    var callback = this._createPostOperationCallBack(operationParameters, extensionName, vmName);
                    this._computeClient.virtualMachineExtensions.createOrUpdate(resourceGroupName, vmName, extensionName, parameters, callback);
                }
            });
            return operationParameters.deferred.promise;
        }
        catch (exception) {
            this.log(tl.loc("MGAgentOperationOnAllVMsFailed", exception.message));
            tl.setResult(tl.TaskResult.Failed, tl.loc("MGAgentOperationOnAllVMsFailed", exception.message));
            operationParameters.deferred.resolve(tl.loc("MGAgentOperationOnAllVMsFailed", exception.message));
        }
    }

    public deleteMGExtensionRG() {
        try {
            var operationParameters = new OperationParameters("uninstallation");
            operationParameters.deferred = Q.defer<string>();
            var listOfVmsPromise = this._azureUtils.getVMDetails();
            listOfVmsPromise.then((listOfVms) => {
                operationParameters.vmCount = listOfVms.length;
                if (operationParameters.vmCount === 0) {
                    operationParameters.deferred.resolve("");
                }
                for (var i = 0; i < listOfVms.length; i++) {
                    var vmName = listOfVms[i]["name"];
                    var resourceGroupName = this._taskParameters.resourceGroupName;
                    var extensionParameters = this._formExtensionParameters(listOfVms[i], operationParameters.operation);
                    this.log(tl.loc("DeleteExtension", extensionParameters["extensionName"], vmName));
                    var extensionName = extensionParameters["extensionName"];
                    var callback = this._createPostOperationCallBack(operationParameters, extensionName, vmName);
                    var extensionDeletionCallback = this._createExtensionDeletionCallback(operationParameters, resourceGroupName, extensionName, vmName, callback);
                    this._computeClient.virtualMachineExtensions.get(resourceGroupName, vmName, extensionName, extensionDeletionCallback);
                }
            });
            return operationParameters.deferred.promise;
        }
        catch (exception) {
            this.log(tl.loc("MGAgentOperationOnAllVMsFailed", operationParameters.operation, exception.message));
            tl.setResult(tl.TaskResult.Failed, tl.loc("MGAgentOperationOnAllVMsFailed", operationParameters.operation, exception.message));
            operationParameters.deferred.reject(tl.loc("MGAgentOperationOnAllVMsFailed", operationParameters.operation, exception.message));
        }
    }

    public deleteMGExtension(virtualMachine) {
        try {
            var operationParameters = new OperationParameters("uninstallation");
            operationParameters.deferred = Q.defer<string>();
            var vmName = virtualMachine["name"]
            var resourceGroupName = this._taskParameters.resourceGroupName;
            var extensionParameters = this._formExtensionParameters(virtualMachine, operationParameters.operation);
            var extensionName = extensionParameters["extensionName"];
            this.log(tl.loc("DeleteExtension", extensionName, vmName));
            var callback = (error, result, request, response) => {
                if (error) {
                    operationParameters.deferred.reject("");
                }
                else {
                    operationParameters.deferred.resolve("");
                }
            }
            var extensionDeletionCallback = (error, result, request, response) => {
                if (error) {
                    this.log(tl.loc("SkipDeleteExtension", extensionName, vmName));
                    operationParameters.deferred.resolve("");
                }
                else {
                    this._computeClient.virtualMachineExtensions.deleteMethod(resourceGroupName, vmName, extensionName, callback);
                }
            }
            this._computeClient.virtualMachineExtensions.get(resourceGroupName, vmName, extensionName, extensionDeletionCallback);
            return operationParameters.deferred.promise;
        }
        catch (exception) {
            this.log(tl.loc("MGAgentOperationOnAllVMsFailed", operationParameters.operation, exception.message));
            tl.setResult(tl.TaskResult.Failed, tl.loc("MGAgentOperationOnAllVMsFailed", operationParameters.operation, exception.message));
            operationParameters.deferred.reject(tl.loc("MGAgentOperationOnAllVMsFailed", operationParameters.operation, exception.message));
        }
    }

    private _settlePromise(operationParameters) {
        if (operationParameters.failureCount + operationParameters.successCount == operationParameters.vmCount) {
            if (operationParameters.failureCount > 0) {
                operationParameters.log(tl.loc("MGAgentOperationOnAllVMsFailed", operationParameters.operation, ""));
                operationParameters.deferred.reject(operationParameters.operation);
            }
            else {
                if (operationParameters.vmCount !== 0) {
                    this.log(tl.loc("MGAgentOperationOnAllVMsSucceeded", operationParameters.operation));
                }
                operationParameters.deferred.resolve(operationParameters.operation);
            }
        }
    }

    private _createExtensionDeletionCallback(operationParameters, resourceGroupName, extensionName, vmName, callback) {
        var extensionDeletionCallback = (error, result, request, response) => {
            if (error) {
                this.log(tl.loc("SkipDeleteExtension", extensionName, vmName));
                operationParameters.vmCount--;
            }
            else {
                this._computeClient.virtualMachineExtensions.deleteMethod(resourceGroupName, vmName, extensionName, callback);
            }
            if (operationParameters.vmCount === 0) {
                this._settlePromise(operationParameters);
            }
        }
        return extensionDeletionCallback;
    }

    private _createPostOperationCallBack(operationParameters, extensionName, vmName) {
        var postOperationCallBack = (error, result, request, response) => {
            if (error) {
                operationParameters.failureCount++;
                operationParameters.errors += error.message;
                operationParameters.errors += "\n";
                operationParameters.log(tl.loc("OperationFailed", operationParameters.operation, extensionName, vmName));
            } else {
                operationParameters.successCount++;
                this.log(tl.loc("OperationSucceeded", operationParameters.operation, extensionName, vmName));
            }
            this._settlePromise(operationParameters);
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
            var collectionUri = tl.getVariable('system.TeamFoundationCollectionUri');
            var teamProject = tl.getVariable('system.teamProject');
            var uriLength = collectionUri.length;
            if (collectionUri[uriLength - 1] == '/') {
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
    public errors: string;
    public vmCount: number;
    public deferred;
    public operation: string;

    constructor(operation) {
        this.successCount = 0;
        this.failureCount = 0;
        this.vmCount = 0;
        this.errors = "";
        this.operation = operation;
        return this;
    }
}