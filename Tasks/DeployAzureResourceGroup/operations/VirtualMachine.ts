/// <reference path="../../../definitions/node.d.ts" /> 
/// <reference path="../../../definitions/vsts-task-lib.d.ts" /> 

import path = require("path");
import tl = require("vsts-task-lib/task");

import armCompute = require('./azure-rest/azure-arm-compute');
import deployAzureRG = require("../models/DeployAzureRG");

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
    }

    public execute(): Promise<void> {
        var client = new armCompute.ComputeManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        return new Promise<void>((resolve, reject) => {
            client.virtualMachines.list(this.taskParameters.resourceGroupName, null, (error, listOfVms, request, response) => {
                if (error) {
                    reject(tl.loc("VM_ListFetchFailed", this.taskParameters.resourceGroupName, error.message));
                }
                if (listOfVms.length == 0) {
                    console.log(tl.loc("NoVMsFound"));
                    resolve(null);
                }

                var callback = this.getCallback(listOfVms.length, resolve, reject);

                for (var i = 0; i < listOfVms.length; i++) {
                    var vmName = listOfVms[i]["name"];
                    switch (this.taskParameters.action) {
                        case "Start":
                            console.log(tl.loc("VM_Start", vmName));
                            client.virtualMachines.start(this.taskParameters.resourceGroupName, vmName, callback);
                            break;
                        case "Stop":
                            console.log(tl.loc("VM_Stop", vmName));
                            client.virtualMachines.powerOff(this.taskParameters.resourceGroupName, vmName, callback);
                            break;
                        case "Restart":
                            console.log(tl.loc("VM_Restart", vmName));
                            client.virtualMachines.restart(this.taskParameters.resourceGroupName, vmName, callback);
                            break;
                        case "Delete":
                            console.log(tl.loc("VM_Delete", vmName));
                            client.virtualMachines.deleteMethod(this.taskParameters.resourceGroupName, vmName, callback);
                    }
                }
            });
        });
    }

    private getCallback(count: number, resolve, reject): (error, result, request, response) => void {
        var successCount = 0;
        var failureCount = 0;
        var total = count;
        var errors = "";

        return function (error, result, request, response) {
            if (error) {
                failureCount++;
                errors += error.message;
                errors += "\n";
            } else {
                successCount++;
            }

            if (successCount + failureCount == total) {
                if (failureCount) {
                    reject(tl.loc("FailureOnVMOperation", this.taskParameters.action, this.errors));
                }
                else {
                    console.log(tl.loc("SucceededOnVMOperation", this.taskParameters.action));
                    resolve();
                }
            }
        }
    }
}


