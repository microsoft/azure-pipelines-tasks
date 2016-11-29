var networkManagementClient = require("azure-arm-network");
var computeManagementClient = require("azure-arm-compute");
import q = require("q");
import deployAzureRG = require("./DeployAzureRG");

export class AzureUtil {
    private taskParameters: deployAzureRG.AzureRGTaskParameters;
    public loadBalancersDetails;
    public vmDetails;
    public networkInterfaceDetails;
    public publicAddressDetails;

    constructor(taskParameters) {
        this.taskParameters = taskParameters;
    }

    public getDetails() {
        var deferred = q.defer();
        var details = [this.getLoadBalancers(), this.getNetworkInterfaceDetails(), this.getPublicIPAddresses(), this.getVMDetails()];
        q.all(details).then(() => {
            this.loadBalancersDetails = details[0];
            this.vmDetails = details[3];
            this.networkInterfaceDetails = details[1];
            this.publicAddressDetails = details[2];
            q.resolve(this);
        })
        return deferred.promise;
    }

    
    private getLoadBalancers() {
        var deferred = q.defer();
        var armClient = new networkManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        armClient.loadBalancers.list(this.taskParameters.resourceGroupName, (error, loadbalancers, request, response) => {
            if (error){
                console.log("Error while getting list of Load Balancers", error);
                throw new Error("FailedToFetchLoadBalancers");
            }
            deferred.resolve(loadbalancers);
        });
        return deferred.promise;
    }

    private getVMDetails() {
        var deferred = q.defer();
        var armClient = new computeManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        armClient.virtualMachines.list(this.taskParameters.resourceGroupName, (error, virtualMachines, request, response) => {
            if (error){
                console.log("Error while getting list of Virtual Machines", error);
                throw new Error("FailedToFetchVMs");
            }
            deferred.resolve(virtualMachines);
        });
        return deferred.promise;
    }

    private getNetworkInterfaceDetails() {
        var deferred = q.defer();
        var armClient = new networkManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        armClient.networkInterfaces.list(this.taskParameters.resourceGroupName, (error, networkInterfaces, request, response) => {
            if (error){
                console.log("Error while getting list of Network Interfaces", error);
                throw new Error("FailedToFetchNetworkInterfaces");
            }
            deferred.resolve(networkInterfaces);
        });
        return deferred.promise;
    }

    private getPublicIPAddresses() {
        var deferred = q.defer();
        var armClient = new networkManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        armClient.publicIPAddresses.list(this.taskParameters.resourceGroupName, (error, publicAddresses, request, response) => {
            if (error){
                console.log("Error while getting list of Public Addresses", error);
                throw new Error("FailedToFetchPublicAddresses");
            }
            deferred.resolve(publicAddresses);
        });
        return deferred.promise;
    }
    
}