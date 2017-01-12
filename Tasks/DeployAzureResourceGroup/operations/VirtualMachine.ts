/// <reference path="../../../definitions/node.d.ts" /> 
/// <reference path="../../../definitions/vsts-task-lib.d.ts" /> 

import path = require("path");
import tl = require("vsts-task-lib/task");

import armCompute = require('./azure-rest/azure-arm-compute');

import deployAzureRG = require("../models/DeployAzureRG");

import q = require("q");

export class VirtualMachine {
    private taskParameters: deployAzureRG.AzureRGTaskParameters;
    private client;
    private failureCount: number;
    private successCount: number;
    private vmCount: number;
    private errors: string;
    private executionDeferred: q.Deferred<void>;

    constructor(taskParameters: deployAzureRG.AzureRGTaskParameters) {
        this.taskParameters = taskParameters;
        this.successCount = 0;
        this.failureCount = 0;
    }

    public execute(): void {
        var client = new armCompute.ComputeManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        client.virtualMachines.list(this.taskParameters.resourceGroupName, null, (error, listOfVms, request, response) => {
            this.executionDeferred = q.defer<void>();
            if (error != undefined) {
                this.executionDeferred.reject(tl.loc("VM_ListFetchFailed", this.taskParameters.resourceGroupName, error.message));
            }
            if (listOfVms.length == 0) {
                console.log(tl.loc("NoVMsFound"));
                console.log(tl.loc("SucceededOnVMOperation", this.taskParameters.action))
                this.executionDeferred.resolve(null);
            }
            this.vmCount = listOfVms.length;
            for (var i = 0; i < listOfVms.length; i++) {
                var vmName = listOfVms[i]["name"];
                switch (this.taskParameters.action) {
                    case "Start":
                        console.log(tl.loc("VM_Start", vmName));
                        client.virtualMachines.start(this.taskParameters.resourceGroupName, vmName, this.postOperationCallBack);
                        break;
                    case "Stop":
                        console.log(tl.loc("VM_Stop", vmName));
                        client.virtualMachines.powerOff(this.taskParameters.resourceGroupName, vmName, this.postOperationCallBack);
                        break;
                    case "Restart":
                        console.log(tl.loc("VM_Restart", vmName));
                        client.virtualMachines.restart(this.taskParameters.resourceGroupName, vmName, this.postOperationCallBack);
                        break;
                    case "Delete":
                        console.log(tl.loc("VM_Delete", vmName));
                        client.virtualMachines.deleteMethod(this.taskParameters.resourceGroupName, vmName, this.postOperationCallBack);
                }
            }
        });
    }

    public isDone(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.executionDeferred.promise.then(() => resolve())
                                          .catch((error) => reject(error));
        });
    }

    private postOperationCallBack = (error, result, request, response) => {
        if (error) {
            this.failureCount++;
            this.errors += error.message;
            this.errors += "\n";
        } else {
            this.successCount++;
        }
        this.setTaskResult();
    }

    private setTaskResult(): void {
        if (this.failureCount + this.successCount == this.vmCount) {
            if (this.failureCount > 0) {
                this.executionDeferred.reject(tl.loc("FailureOnVMOperation", this.taskParameters.action, this.errors));
            }
            console.log(tl.loc("SucceededOnVMOperation", this.taskParameters.action));
            this.executionDeferred.resolve(null);
        }
    }
}


