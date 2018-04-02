import computeManagementClient = require("azure-arm-rest/azure-arm-compute");
import validateInputs = require("./ValidateInputs");
import az = require("azure-arm-rest/azureModels");
import tl = require("vsts-task-lib/task");

export class AzureUtil {
    private taskParameters: validateInputs.AzureFileCopyXplatTaskParameters;
    private computeClient: computeManagementClient.ComputeManagementClient;
    public vmDetails: az.VM[];
    constructor(taskParameters: validateInputs.AzureFileCopyXplatTaskParameters, computeClient?: computeManagementClient.ComputeManagementClient) {
        this.taskParameters = taskParameters;
        this.computeClient = computeClient || new computeManagementClient.ComputeManagementClient(this.taskParameters.armCredentials, this.taskParameters.subscriptionId);
    }
    public getVMDetails(): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.computeClient.virtualMachines.list(this.taskParameters.resourceGroupName, null, (error, virtualMachines, request, response) => {
                if (error) {
                    return reject(tl.loc("VM_ListFetchFailed", this.taskParameters.resourceGroupName, error));
                }
                tl.debug("Virtual Machines details: " + JSON.stringify(virtualMachines));
                this.vmDetails = virtualMachines;
                resolve(virtualMachines);
            });
        });
    }
}