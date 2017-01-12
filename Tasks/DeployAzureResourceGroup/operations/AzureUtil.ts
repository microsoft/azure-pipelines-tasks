import networkManagementClient = require("./azure-rest/azure-arm-network");
import computeManagementClient = require("./azure-rest/azure-arm-compute");
import q = require("q");
import deployAzureRG = require("../models/DeployAzureRG");
import tl = require("vsts-task-lib/task")

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
            deferred.resolve(this);
        }).catch((error) => {
            deferred.reject(error);
        })
        return deferred.promise;
    }

    
    public getLoadBalancers() {
        var deferred = q.defer();
        var armClient = new networkManagementClient.NetworkManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        armClient.loadBalancers.list(this.taskParameters.resourceGroupName, (error, loadbalancers, request, response) => {
            if (error){
                console.log(tl.loc("FailedToFetchLoadBalancers"), error);
                throw new Error(tl.loc("FailedToFetchLoadBalancers"));
            }
            this.loadBalancersDetails = loadbalancers;
            deferred.resolve(loadbalancers);
        });
        return deferred.promise;
    }

    public getVMDetails() {
        var deferred = q.defer();
        var armClient = new computeManagementClient.ComputeManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        armClient.virtualMachines.list(this.taskParameters.resourceGroupName, (error, virtualMachines, request, response) => {
            if (error){
                console.log(tl.loc("FailedToFetchVMs"), error);
                throw new Error(tl.loc("FailedToFetchVMs"));
            }
            this.vmDetails = virtualMachines;
            deferred.resolve(virtualMachines);
        });
        return deferred.promise;
    }

    public getNetworkInterfaceDetails() {
        var deferred = q.defer();
        var armClient = new networkManagementClient.NetworkManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        armClient.networkInterfaces.list(this.taskParameters.resourceGroupName, null, (error, networkInterfaces, request, response) => {
            if (error){
                console.log(tl.loc("FailedToFetchNetworkInterfaces"), error);
                throw new Error(tl.loc("FailedToFetchNetworkInterfaces"));
            }
            this.networkInterfaceDetails = networkInterfaces;
            deferred.resolve(networkInterfaces);
        });
        return deferred.promise;
    }

    public getPublicIPAddresses() {
        var deferred = q.defer();
        var armClient = new networkManagementClient.NetworkManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        armClient.publicIPAddresses.list(this.taskParameters.resourceGroupName, null, (error, publicAddresses, request, response) => {
            if (error){
                console.log(tl.loc("FailedToFetchPublicAddresses"), error);
                throw new Error(tl.loc("FailedToFetchPublicAddresses"));
            }
            this.publicAddressDetails = publicAddresses;
            deferred.resolve(publicAddresses);
        });
        return deferred.promise;
    }
    
}