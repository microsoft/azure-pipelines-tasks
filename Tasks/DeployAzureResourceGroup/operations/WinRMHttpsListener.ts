import networkManagementClient = require("./azure-rest/azure-arm-network");
import computeManagementClient = require("./azure-rest/azure-arm-compute");
import Q = require('q');
import util = require("util");
import tl = require("vsts-task-lib/task");
import azure_utils = require("./AzureUtil");
import deployAzureRG = require("../models/DeployAzureRG");
import az = require("./azure-rest/azureModels");

function isNonEmpty(str: string) {
    return str && str.trim();
}

function ObjectCast(rawObj, constructor) {
    var obj = new constructor();
    for (var i in rawObj)
        obj.i = rawObj[i];
    return obj;
}

export class WinRMHttpsListener {
    private taskParameters: deployAzureRG.AzureRGTaskParameters;
    private resourceGroupName: string;
    private credentials;
    private subscriptionId: string;
    private fqdnMap;
    private winRmHttpsPortMap;
    private virtualMachines;
    private customScriptExtensionInstalled: boolean;
    private ruleAddedToNsg: boolean;
    private azureUtils: azure_utils.AzureUtil;
    private networkClient: networkManagementClient.NetworkManagementClient

    constructor(taskParameters: deployAzureRG.AzureRGTaskParameters) {
        this.taskParameters = taskParameters;
        this.resourceGroupName = this.taskParameters.resourceGroupName;
        this.credentials = this.taskParameters.credentials;
        this.subscriptionId = this.taskParameters.subscriptionId;
        this.fqdnMap = {};
        this.winRmHttpsPortMap = {};
        this.customScriptExtensionInstalled = false;
        this.ruleAddedToNsg = false;

        this.networkClient = new networkManagementClient.NetworkManagementClient(this.credentials, this.subscriptionId);
        this.azureUtils = new azure_utils.AzureUtil(this.taskParameters);
    }

    public async EnableWinRMHttpsListener() {
        await this.AddInboundNatRuleLB();
        var resourceGroupDetails = await this.azureUtils.getResourceGroupDetails();

        for (var vm of this.azureUtils.vmDetails) {
            var resourceName = vm.name;
            var resourceId = vm.id;
            var vmResource = resourceGroupDetails.VirtualMachines.find(v => v.Name == resourceName);
            var resourceFQDN = vmResource.WinRMHttpsPublicAddress;
            var resourceWinRmHttpsPort = vmResource.WinRMHttpsPort

            if (vm["properties"]["storageProfile"]["osDisk"]["osType"] === 'Windows') {
                tl.debug("Enabling winrm for virtual machine " + resourceName);
                await this.AddAzureVMCustomScriptExtension(resourceId, resourceName, resourceFQDN, vm["location"]);
            }
        }

        await this.AddWinRMHttpsNetworkSecurityRuleConfig();
    }

    private async AddInboundNatRuleLB(): Promise<void> {
        var resourceGroupDetails = await this.azureUtils.getResourceGroupDetails();
        for (var virtualMachine of resourceGroupDetails.VirtualMachines) {
            if (!isNonEmpty(virtualMachine.WinRMHttpsPublicAddress)) {
                var lb: azure_utils.LoadBalancer;
                var nicId: string;
                for (var nic in virtualMachine.NetworkInterfaceIds) {
                    nicId = nic;
                    lb = resourceGroupDetails.LoadBalancers.find(l => !!l.BackendNicIds.find(id => id === nic));
                    if (lb) break;
                }

                if (lb) {
                    var frontendPort: number = this.GetFreeFrontendPort(lb);
                    await this.AddNatRuleInternal(lb.Id, nicId, frontendPort, 5986);
                    lb.FrontEndPortsInUse.push(frontendPort);
                }
            }
        }
    }

    private GetFreeFrontendPort(loadBalancer: azure_utils.LoadBalancer): number {
        var port: number = 5986;
        while (loadBalancer.FrontEndPortsInUse.find(p => p == port)) {
            port++;
        }
        return port;
    }

    private async AddNatRuleInternal(loadBalancerId: string, networkInterfaceId: string, fronendPort: number, backendPort: number): Promise<void> {
        var random: number = Math.floor(Math.random() * 10000 + 100);
        var name: string = "winRMHttpsRule" + random.toString();

        var newRule: az.InboundNatRule = new az.InboundNatRule();
        newRule.name = name;
        newRule.properties = new az.InboundNatRuleProperties();
        var loadBalancers = await this.azureUtils.getLoadBalancers();
        var loadBalancer = loadBalancers.find(l => l.id == loadBalancerId);

        var InboundNatRuleProperties: az.InboundNatRuleProperties = ObjectCast({
            backendPort: backendPort,
            frontendPort: fronendPort,
            frontendIPConfiguration: { id: loadBalancer.properties.frontendIPConfigurations[0].id },
            protocol: "Tcp",
            idleTimeoutInMinutes: 4,
            enableFloatingIP: false
        }, az.InboundNatRuleProperties);

        var rule: az.InboundNatRule = ObjectCast({
            id: "",
            name: name,
            properties: InboundNatRuleProperties
        }, az.InboundNatRule);

        loadBalancer.properties.inboundNatRules.push(rule);
        var networkInterfaces = this.azureUtils.networkInterfaceDetails;
        var networkInterface = networkInterfaces.find(n => n.id == networkInterfaceId);
        var ipConfiguration: az.IPConfiguration;

        for (var ipc of networkInterface.properties.ipConfigurations) {
            for (var pool of loadBalancer.properties.backendAddressPools) {
                if (pool.properties.backendIPConfigurations && pool.properties.backendIPConfigurations.find(x => x.id == ipc.id)) {
                    if (!ipc.properties.loadBalancerInboundNatRules) {
                        ipc.properties.loadBalancerInboundNatRules = [];
                        ipConfiguration = ipc;
                        break;
                    }
                }
            }
        }

        return new Promise<void>((resolve, reject) => {
            this.networkClient.loadBalancers.createOrUpdate(this.resourceGroupName, loadBalancer.name, loadBalancer, null, (error, result, request, response) => {
                if (error) {
                    reject(error);
                }
                else {
                    console.log(tl.loc("AddedInboundNatRuleLB", loadBalancer.name));
                    var loadBalancerUpdated = <az.LoadBalancer>result;
                    var addedRule = loadBalancerUpdated.properties.inboundNatRules.find(r => r.properties.frontendPort == fronendPort);
                    ipConfiguration.properties.loadBalancerInboundNatRules.push(addedRule);
                    this.networkClient.networkInterfaces.createOrUpdate(this.resourceGroupName, networkInterface.name, networkInterface, null,
                        (error2, result2, request2, response2) => {
                            if (error2) {
                                reject(error2);
                            }
                            console.log(tl.loc("AddedTargetInboundNatRuleLB", networkInterface.name));
                            resolve();
                        });
                }
            });
        });

    }

    private async AddInboundNetworkSecurityRule(retryCnt: number, securityGrpName, networkClient, ruleName, rulePriority, winrmHttpsPort) {
        var deferred = Q.defer<string>();
        try {
            tl.debug("Adding inbound network security rule config " + ruleName + " with priority " + rulePriority + " for port " + winrmHttpsPort + " under security group " + securityGrpName);
            var securityRuleParameters = {
                properties: {
                    direction: "Inbound",
                    access: "Allow",
                    sourceAddressPrefix: "*",
                    sourcePortRange: "*",
                    destinationAddressPrefix: "*",
                    destinationPortRange: winrmHttpsPort,
                    protocol: "*",
                    priority: rulePriority
                }
            };
            var networkClient1 = new networkManagementClient.NetworkManagementClient(this.credentials, this.subscriptionId);
            networkClient1.securityRules.createOrUpdate(this.resourceGroupName, securityGrpName, ruleName, securityRuleParameters, (error, result, request, response) => {
                if (error) {
                    tl.debug("Error in adding network security rule " + util.inspect(error, { depth: null }));
                    throw tl.loc("FailedToAddRuleToNetworkSecurityGroup", securityGrpName);
                }
                console.log(tl.loc("AddedSecurityRuleNSG", ruleName, rulePriority, winrmHttpsPort, securityGrpName, util.inspect(result, { depth: null })));
                this.ruleAddedToNsg = true;
                deferred.resolve("");
            });
        }
        catch (exception) {
            tl.debug("Failed to add inbound network security rule config " + ruleName + " with priority " + rulePriority + " for port " + winrmHttpsPort + " under security group " + securityGrpName + " : " + exception.message);
            rulePriority = rulePriority + 50;
            tl.debug("Getting network security group" + securityGrpName + " in resource group " + this.resourceGroupName);

            networkClient.networkSecurityGroups.list(this.resourceGroupName, async (error, result, request, response) => {
                if (error) {
                    tl.debug("Error in getting the list of network Security Groups for the resource-group " + this.resourceGroupName);
                    deferred.reject(tl.loc("FetchingOfNetworkSecurityGroupFailed", error));
                    return;
                }

                if (result.length > 0) {
                    tl.debug("Got network security group " + securityGrpName + " in resource group " + this.resourceGroupName);
                    if (retryCnt > 0) {
                        try {
                            await this.AddInboundNetworkSecurityRule(retryCnt - 1, securityGrpName, networkClient, ruleName, rulePriority, winrmHttpsPort);
                        }
                        catch (exception) {
                            deferred.reject(exception);
                            return;
                        }
                        deferred.resolve("");
                    }
                    else {
                        tl.debug("Failed to add the NSG rule on security group " + securityGrpName + " after trying for 3 times ");
                        deferred.reject(tl.loc("FailedAddingNSGRule3Times", securityGrpName));
                    }
                }
            });
        }
        return deferred.promise;
    }

    private async TryAddNetworkSecurityRule(securityGrpName, ruleName, rulePriority: number, winrmHttpsPort: string) {
        var deferred = Q.defer<string>();
        var networkClient = new networkManagementClient.NetworkManagementClient(this.credentials, this.subscriptionId);
        try {
            networkClient.securityRules.get(this.resourceGroupName, securityGrpName, ruleName, null, async (error, result, request, response) => {
                if (error) {
                    tl.debug("Rule " + ruleName + " not found under security Group " + securityGrpName);
                    var maxRetries = 3;
                    try {
                        await this.AddInboundNetworkSecurityRule(maxRetries, securityGrpName, networkClient, ruleName, rulePriority, winrmHttpsPort);
                    }
                    catch (exception) {
                        deferred.reject(exception);
                    }
                }
                else {
                    console.log(tl.loc("RuleExistsAlready", ruleName, securityGrpName));
                    this.ruleAddedToNsg = true;
                }
                deferred.resolve("");
            });
        }
        catch (exception) {
            tl.debug("Failed to add rule to network security Group with the exception" + exception.message);
            deferred.reject(tl.loc("FailedToAddRuleToNetworkSecurityGroup", securityGrpName));
        }
        return deferred.promise;
    }

    private async AddNetworkSecurityRuleConfig(securityGroups: [Object], ruleName: string, rulePriority: number, winrmHttpsPort: string) {
        var deferred = Q.defer<string>();

        for (var i = 0; i < securityGroups.length; i++) {
            console.log(tl.loc("AddingSecurityRuleNSG", securityGroups[i]["name"]));
            var securityGrp = securityGroups[i];
            var securityGrpName = securityGrp["name"];

            try {
                tl.debug("Getting the network security rule config " + ruleName + " under security group " + securityGrpName);
                await this.TryAddNetworkSecurityRule(securityGrpName, ruleName, rulePriority, winrmHttpsPort);
            }
            catch (exception) {
                tl.debug("Failed to add the network security rule with exception: " + exception.message);
                deferred.reject(tl.loc("FailedToAddNetworkSecurityRule", securityGrpName));
            }
        }

        deferred.resolve("");
        return deferred.promise;
    }

    private async AddWinRMHttpsNetworkSecurityRuleConfig() {
        var _ruleName: string = "VSO-Custom-WinRM-Https-Port";
        var _rulePriority: number = 3986;
        var _winrmHttpsPort: string = "5986";
        var deferred = Q.defer<string>();

        /* 
            var securityGroups = await this.getSecurityRuleConfigs();
            if (securityGroups) 
            {
                for (var securityGroup of securityGroups) {
                    await this.AddRuleToSecurity(securityGroup);
                }
            }
         */

        try {
            var networkClient = new networkManagementClient.NetworkManagementClient(this.credentials, this.subscriptionId);
            networkClient.networkSecurityGroups.list(this.resourceGroupName, null, async (error, result, request, response) => {
                if (error) {
                    tl.debug("Error in getting the list of network Security Groups for the resource-group" + this.resourceGroupName + "error" + util.inspect(error, { depth: null }));
                    this.ruleAddedToNsg = true;
                    deferred.reject(tl.loc("FetchingOfNetworkSecurityGroupFailed", error));
                    return;
                }

                if (result.length > 0) {
                    tl.debug("Trying to add a network security group rule");
                    try {
                        await this.AddNetworkSecurityRuleConfig(result, _ruleName, _rulePriority, _winrmHttpsPort);
                    }
                    catch (exception) {
                        deferred.reject(exception);
                    }
                }
                deferred.resolve("");
            });
        }
        catch (exception) {
            this.ruleAddedToNsg = true;
            deferred.reject(tl.loc("ARG_NetworkSecurityConfigFailed", exception.message));
        }
        return deferred.promise;
    }

    private async AddAzureVMCustomScriptExtension(vmId: string, vmName: string, dnsName: string, location: string) {
        var _extensionName: string = "CustomScriptExtension";
        var _configWinRMScriptFile: string = "https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/201-vm-winrm-windows/ConfigureWinRM.ps1";
        var _makeCertFile: string = "https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/201-vm-winrm-windows/makecert.exe";
        var _winrmConfFile: string = "https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/201-vm-winrm-windows/winrmconf.cmd";
        var fileUris = [_configWinRMScriptFile, _makeCertFile, _winrmConfFile];
        var deferred = Q.defer<string>();

        tl.debug("Adding custom script extension for virtual machine " + vmName);
        tl.debug("VM Location: " + location);
        tl.debug("VM DNS: " + dnsName);

        var computeClient = new computeManagementClient.ComputeManagementClient(this.credentials, this.subscriptionId);
        tl.debug("Checking if the extension " + _extensionName + " is present on vm " + vmName);

        var result = await this.GetExtension(computeClient, vmName, _extensionName);
        var extensionStatusValid = false;
        if (result) {
            if (result["properties"]["settings"]["fileUris"].length == fileUris.length && fileUris.every((element, index) => { return element === result["properties"]["settings"]["fileUris"][index]; })) {

                tl.debug("Custom Script extension is for enabling Https Listener on VM" + vmName);
                if (result["properties"]["provisioningState"] === 'Succeeded') {
                    extensionStatusValid = await this.ValidateCustomScriptExecutionStatus(vmName, computeClient, dnsName, _extensionName, location, fileUris);
                }

                if (!extensionStatusValid) {
                    await this.RemoveExtensionFromVM(_extensionName, vmName, computeClient);
                }
            }
        }
        if (!extensionStatusValid) {
            await this.AddExtensionVM(vmName, computeClient, dnsName, _extensionName, location, fileUris);
        }

        return deferred.promise;
    }

    private GetExtension(computeClient: computeManagementClient.ComputeManagementClient, vmName: string, extensionName: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            computeClient.virtualMachineExtensions.get(this.resourceGroupName, vmName, extensionName, null, async (error, result, request, response) => {
                if (error) {
                    tl.debug("Failed to get the extension!!");
                    resolve(null);
                }

                resolve(result);
            });
        });
    }

    private async ValidateCustomScriptExecutionStatus(vmName: string, computeClient, dnsName: string, extensionName: string, location: string, fileUris): Promise<boolean> {
        tl.debug("Validating the winrm configuration custom script extension status");

        return new Promise<boolean>((resolve, reject) => {
            computeClient.virtualMachines.get(this.resourceGroupName, vmName, { expand: 'instanceView' }, async (error, result, request, response) => {
                if (error) {
                    tl.debug("Error in getting the instance view of the virtual machine " + util.inspect(error, { depth: null }));
                    reject(tl.loc("FailedToFetchInstanceViewVM"));
                    return;
                }

                var invalidExecutionStatus: boolean = false;
                var extension = result["properties"]["instanceView"];
                if (result["name"] === extensionName) {
                    for (var substatus of extension["substatuses"]) {
                        if (substatus["code"] && substatus["code"].indexOf("ComponentStatus/StdErr") >= 0 && !!substatus["message"] && substatus["message"] != "") {
                            invalidExecutionStatus = true;
                            break;
                        }
                    }
                }

                resolve(!invalidExecutionStatus);
            });
        });
    }

    private async AddExtensionVM(vmName: string, computeClient, dnsName: string, extensionName: string, location: string, _fileUris) {
        var _commandToExecute: string = "powershell.exe -File ConfigureWinRM.ps1 " + dnsName;
        var _extensionType: string = 'Microsoft.Compute/virtualMachines/extensions';
        var _virtualMachineExtensionType: string = 'CustomScriptExtension';
        var _typeHandlerVersion: string = '1.7';
        var _publisher: string = 'Microsoft.Compute';

        var deferred = Q.defer<void>();
        var _protectedSettings = { commandToExecute: _commandToExecute };
        var parameters = {
            type: _extensionType,
            location: location,
            properties: {
                publisher: _publisher,
                type: _virtualMachineExtensionType,
                typeHandlerVersion: _typeHandlerVersion,
                settings: {
                    fileUris: _fileUris,
                    commandToExecute: _commandToExecute
                }
            }
        };

        console.log(tl.loc("AddExtension", extensionName, vmName));
        computeClient.virtualMachineExtensions.createOrUpdate(this.resourceGroupName, vmName, extensionName, parameters, async (error, result, request, response) => {
            if (error) {
                tl.debug("Failed to add the extension " + util.inspect(error, { depth: null }));
                deferred.reject(tl.loc("CreationOfExtensionFailed"));
                return;
            }

            tl.debug("Addition of extension completed for vm" + vmName);
            if (result["properties"]["provisioningState"] != 'Succeeded') {
                tl.debug("Provisioning State of CustomScriptExtension is not suceeded on vm " + vmName);
                deferred.reject(tl.loc("ARG_SetExtensionFailedForVm", this.resourceGroupName, vmName, result));
                return;
            }
            tl.debug("Provisioning of CustomScriptExtension on vm " + vmName + " is in Succeeded State");
            this.customScriptExtensionInstalled = true;
            deferred.resolve(null);
        });
        return deferred.promise;
    }

    private async RemoveExtensionFromVM(extensionName, vmName, computeClient) {
        tl.debug("Removing the extension " + extensionName + "from vm " + vmName);
        //delete the extension
        var deferred = Q.defer<void>();

        computeClient.virtualMachineExtensions.deleteMethod(this.resourceGroupName, vmName, extensionName, async (error, result, request, response) => {
            if (error) {
                tl.debug("Failed to delete the extension " + extensionName + " on the vm " + vmName + ", with error Message: " + util.inspect(error, { depth: null }));
                deferred.reject(tl.loc("FailedToDeleteExtension"));
                return;
            }

            tl.debug("Successfully removed the extension " + extensionName + " from the VM " + vmName);
            deferred.resolve(null);
        });

        return deferred.promise;
    }
}