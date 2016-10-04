/// <reference path="../../definitions/node.d.ts" /> 
/// <reference path="../../definitions/vsts-task-lib.d.ts" /> 
  
import path = require("path");
import tl = require("vsts-task-lib/task");

var computeManagementClient = require('azure-arm-compute');

export class VirtualMachine {
    private action:string;
    private resourceGroupName:string;
    private subscriptionId:string;
    private connectedService:string;
    private credentials;
    private operation;
    private client;
    private failureCount:number;
    private successCount:number;
    private vmCount:number;
    private errors:string;

    constructor(resourceGroupName, action, subscriptionID, connectedService, credentials) {
        try {
            this.resourceGroupName = resourceGroupName;
            this.subscriptionId = subscriptionID;
            this.connectedService = connectedService;
            this.credentials = credentials;
            this.client = new computeManagementClient(this.credentials, this.subscriptionId);
            this.action = action;
        } catch (error) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("VMOperationsInitiationFailed", this.action, error.message));
            return;
        }
        this.successCount = 0;
        this.failureCount = 0;
        this.execute();
    }

    private postOperationCallBack = (error, result, request, response) => {
        if (error) {
            this.failureCount++;
            this.errors+=error.message;
            this.errors+="\n";
        } else {
            this.successCount++;
        }
        this.setTaskResult();
    }

    private setTaskResult() {
        if (this.failureCount + this.successCount == this.vmCount) {
            if(this.failureCount>0) {
                tl.setResult(tl.TaskResult.Failed,tl.loc("FailureOnVMOperation", this.action, this.errors));
            } else {
                tl.setResult(tl.TaskResult.Succeeded,tl.loc("SucceededOnVMOperation", this.action));
            }
        }
    }

    private execute() {
        this.client.virtualMachines.list(this.resourceGroupName, (error, listOfVms, request, response) => {
            if (error != undefined){
                tl.setResult(tl.TaskResult.Failed, tl.loc("VM_ListFetchFailed", this.resourceGroupName, error.message));
                return;
            }
            if (listOfVms.length == 0) {
                console.log("No VMs found");
                tl.setResult(tl.TaskResult.Succeeded,tl.loc("SucceededOnVMOperation", this.action));
                return;
            }
            this.vmCount = listOfVms.length;
            switch (this.action) {
                case "Start":
                    for (var i=0; i<listOfVms.length; i++) {
                        var vmName = listOfVms[i]["name"];
                        this.client.virtualMachines.start(this.resourceGroupName, vmName, this.postOperationCallBack);
                    }
                    break;
                case "Stop":
                    for (var i=0; i<listOfVms.length; i++) {
                        var vmName = listOfVms[i]["name"];
                        this.client.virtualMachines.powerOff(this.resourceGroupName, vmName, this.postOperationCallBack);
                    }
                    break;
                case "Restart":
                    for (var i=0; i<listOfVms.length; i++) {
                        var vmName = listOfVms[i]["name"];
                        this.client.virtualMachines.restart(this.resourceGroupName, vmName, this.postOperationCallBack);
                    }
                    break;
                case "Delete":
                    for (var i=0; i<listOfVms.length; i++) {
                        var vmName = listOfVms[i]["name"];
                        this.client.virtualMachines.deleteMethod(this.resourceGroupName, vmName, this.postOperationCallBack);
                    }
            }
        });
    }
}

