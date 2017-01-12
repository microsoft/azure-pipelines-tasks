import networkManagementClient = require("./azure-rest/azure-arm-network");
import computeManagementClient = require("./azure-rest/azure-arm-compute");
import Q = require('q');
import util = require("util");
import tl = require("vsts-task-lib/task");
import azure_utils = require("./AzureUtil");
import deployAzureRG = require("../models/DeployAzureRG");

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
    private azureUtils;

    constructor(taskParameters: deployAzureRG.AzureRGTaskParameters) {
        this.taskParameters = taskParameters;
        this.resourceGroupName = this.taskParameters.resourceGroupName;
        this.credentials = this.taskParameters.credentials;
        this.subscriptionId = this.taskParameters.subscriptionId;
        this.fqdnMap = {};
        this.winRmHttpsPortMap = {};
        this.customScriptExtensionInstalled = false;
        this.ruleAddedToNsg = false;
        this.azureUtils = new azure_utils.AzureUtil(this.taskParameters);
        return this;
    }

    public async EnableWinRMHttpsListener() {
        var deferred = Q.defer();
        try {
            await this.AddInboundNatRuleLB();
            await this.SetAzureRMVMsConnectionDetailsInResourceGroup();

            for (var i = 0; i < this.virtualMachines.length; i++) {
                var vm = this.virtualMachines[i];
                var resourceName = vm["name"];
                var resourceId = vm["id"];
                var resourceFQDN = this.fqdnMap[resourceName];
                var resourceWinRmHttpsPort = this.winRmHttpsPortMap[resourceName];

                if (!resourceWinRmHttpsPort || resourceWinRmHttpsPort === "") {
                    tl.debug("Defaulting WinRmHttpsPort of " + resourceName + " to 5986");
                    this.winRmHttpsPortMap[resourceName] = "5986";
                }
                if (vm["properties"]["storageProfile"]["osDisk"]["osType"] === 'Windows') {
                    tl.debug("Enabling winrm for virtual machine " + resourceName);
                    await this.AddAzureVMCustomScriptExtension(resourceId, resourceName, resourceFQDN, vm["location"]);
                }
            }
            await this.AddWinRMHttpsNetworkSecurityRuleConfig();
            deferred.resolve(null);
        }
        catch (exception) {
            console.log(tl.loc("FailedToEnablePrereqs", exception.message));
            deferred.reject(tl.loc("FailedToEnablePrereqs", exception.message));
        }
        return deferred.promise;
    }

    private async AddRule(lb, frontendPortMap) {
        var ruleIdMap = {};
        var lbName = lb["name"];
        var addedRulesId = [];
        var deferred = Q.defer();
        var networkClient = new networkManagementClient.NetworkManagementClient(this.credentials, this.subscriptionId);

        tl.debug("Updating the load balancers with the appropriate Inbound Nat rules");

        var parameters = {
            location: lb["location"],
            properties: {
                frontendIPConfigurations: lb["properties"]["frontendIPConfigurations"],
                inboundNatRules: lb["properties"]["inboundNatRules"],
                backendAddressPools: lb["properties"]["backendAddressPools"]
            }
        };

        networkClient.loadBalancers.createOrUpdate(this.resourceGroupName, lbName, parameters, null, async (error, result, request, response) => {
            if (error) {
                tl.debug("Failed with error " + util.inspect(error, { depth: null }));
                deferred.reject(tl.loc("FailedToUpdateInboundNatRuleLB", lbName));
            }
            console.log(tl.loc("AddedInboundNatRuleLB", lbName));

            var addedRulesId = [];

            for (var rule of result["properties"]["inboundNatRules"]) {
                var index = rule["properties"]["frontendPort"].toString();
                var ipc = frontendPortMap[index];

                if (!!ipc && ipc != "") {
                    if (!ruleIdMap[ipc]) {
                        ruleIdMap[ipc] = [];
                    }
                    ruleIdMap[ipc].push(rule["id"]);
                    addedRulesId.push(rule["id"]);
                }
            }

            tl.debug("Added rules id are:");
            for (var id of addedRulesId) {
                tl.debug("Id: " + id);
            }

            var networkInterfaces = await this.azureUtils.getNetworkInterfaceDetails();
            for (var nic of networkInterfaces) {
                var flag: boolean = false;
                for (var ipc of nic["properties"]["ipConfigurations"]) {
                    if (!!ruleIdMap[ipc["id"]] && ruleIdMap[ipc["id"]] != "") {
                        for (var rule of ruleIdMap[ipc["id"]]) {
                            if (!ipc["properties"]["loadBalancerInboundNatRules"]) {
                                ipc["properties"]["loadBalancerInboundNatRules"] = [];
                            }
                            ipc["properties"]["loadBalancerInboundNatRules"].push({ "id": rule });
                            flag = true;
                        }
                    }
                }
                if (flag) {
                    await this.addTargetVmsToInboundNatRules(networkClient, nic, addedRulesId, lbName, lb);
                }
            }
            //Remove the rules which has no target virtual machines
            await this.removeIrrelevantRules(lb, networkClient, addedRulesId);
            deferred.resolve("");

        });

        return deferred.promise;
    }

    private async addTargetVmsToInboundNatRules(networkClient, nic, addedRulesId, lbName, lb) {
        var deferred = Q.defer<void>();
        tl.debug("Updating the NIC of the concerned vms");
        var parameters = {
            location: nic["location"],
            properties: {
                ipConfigurations: nic["properties"]["ipConfigurations"]
            }
        }
        networkClient.networkInterfaces.createOrUpdate(this.resourceGroupName, nic["name"], parameters, async (error, res, response, request) => {
            if (error) {
                tl.debug("Error in updating the list of Network Interfaces: " + util.inspect(error, { depth: null }));
                deferred.reject(tl.loc("FailedToUpdateNICOfVm"));
            }
            tl.debug("Successfully updated network interfaces: ");
            console.log(tl.loc("AddedTargetInboundNatRuleLB", lbName));
            deferred.resolve(null);
        });
        return deferred.promise;
    }

    private async removeIrrelevantRules(lb, networkClient, addedRulesId) {
        var lbName = lb["name"];
        var deferred = Q.defer<string>();
        networkClient.loadBalancers.get(this.resourceGroupName, lbName, (error, lbDetails, request, response) => {
            if (error) {
                tl.debug("Error in getting the details of the load Balancer: " + lbName);
                deferred.reject(tl.loc("FailedToFetchDetailsOfLB", lbName));
            }

            var updateRequired = false;
            var relevantRules = [];

            if (lbDetails["properties"]["inboundNatRules"]) {
                for (var rule of lbDetails["properties"]["inboundNatRules"]) {
                    if (addedRulesId.find((x) => x == rule["id"])) {
                        if (rule["properties"]["backendPort"] === 5986 && rule["properties"]["backendIPConfiguration"] && rule["properties"]["backendIPConfiguration"]["id"] && rule["properties"]["backendIPConfiguration"]["id"] != "") {
                            relevantRules.push(rule);
                        }
                        else {
                            updateRequired = true;
                        }
                    }
                }
            }

            if (updateRequired) {
                tl.debug("Removing irrelevant rules");
                var parameters = {
                    location: lb["location"],
                    properties: {
                        frontendIPConfigurations: lb["properties"]["frontendIPConfigurations"],
                        inboundNatRules: relevantRules,
                        backendAddressPools: lb["properties"]["backendAddressPools"]
                    }
                }
                networkClient.loadBalancers.createOrUpdate(this.resourceGroupName, lbName, parameters, (error, result, request, response) => {
                    if (error) {
                        tl.debug("Failed to update the inbound Nat rules of Load balancer " + lbName + "to remove irrelevant rules");
                        deferred.reject(tl.loc("FailedToUpdateLBInboundNatRules", lbName));
                    }
                    tl.debug("Successfully Updated the inbound Nat Rules: " + lbName);
                    deferred.resolve("");
                });
            }
            else {
                deferred.resolve("");
            }
        });
        return deferred.promise;
    }

    public async AddInboundNatRuleLB() {
        var inboundWinrmHttpPort = {};
        var networkClient = new networkManagementClient.NetworkManagementClient(this.credentials, this.subscriptionId);
        var deferred = Q.defer<string>();

        var loadBalancers = await this.azureUtils.getLoadBalancers();
        for (var lb of loadBalancers) {
            /*1. Find all the busy ports
              2. Find the vms which are in backend Pools but their winRMPort is not mapped
              3. Next add the inbound NAT rules
            */
            var vmsInBackendPool = {};
            var UnallocatedVMs = [];
            var usedPorts = [];
            var lbName = lb["name"];

            var pools = lb["properties"]["backendAddressPools"];
            for (var pool of pools) {
                if (pool && pool["properties"]["backendIPConfigurations"]) {
                    var ipConfigs = pool["properties"]["backendIPConfigurations"];
                    for (var ipc of ipConfigs) {
                        vmsInBackendPool[ipc["id"]] = "Exists";
                    }
                }
            }

            for (var rule of lb["properties"]["inboundNatRules"]) {
                usedPorts.push(rule["properties"]["frontendPort"]);
                if (rule["properties"]["backendPort"] === 5986 && rule["properties"]["backendIPConfiguration"] && rule["properties"]["backendIPConfiguration"]["id"]) {
                    if (!!vmsInBackendPool[rule["properties"]["backendIPConfiguration"]["id"]] && vmsInBackendPool[rule["properties"]["backendIPConfiguration"]["id"]] === "Exists") {
                        delete vmsInBackendPool[rule["properties"]["backendIPConfiguration"]["id"]];
                    }
                }
            }

            var port: number = 5986;
            var frontendPortMap = {};
            var frontendPorts = [];

            for (var key in vmsInBackendPool) {
                //find the port which is free
                var found: boolean = false;
                while (!found) {
                    if (!usedPorts.find((x) => x == port)) {
                        found = true;
                        vmsInBackendPool[key] = port;
                        frontendPortMap[port] = key;
                        frontendPorts.push(port);
                    }
                    port++;
                }
            }

            var newRule = {};
            var empty = true;
            var addedRules = [];

            for (var key in vmsInBackendPool) {
                empty = false;
                var random: number = Math.floor(Math.random() * 10000 + 100);
                var name: string = "winRMHttpsRule" + random.toString();
                newRule = {
                    "name": name,
                    "properties": {
                        "backendPort": 5986,
                        "frontendPort": vmsInBackendPool[key],
                        "frontendIPConfiguration": { "id": lb["properties"]["frontendIPConfigurations"][0]["id"] },
                        "protocol": "Tcp",
                        "idleTimeoutInMinutes": 4,
                        "enableFloatingIP": false
                    }
                };
                lb["properties"]["inboundNatRules"].push(newRule);
            }
            var ruleIdMap = {};
            if (!empty) {
                await this.AddRule(lb, frontendPortMap);
            }
            else {
                tl.debug("No vms left for adding inbound nat rules for load balancer " + lbName);
                console.log(tl.loc("InboundNatRuleLBPresent", lbName));
            }
        }
        deferred.resolve("");
        return deferred.promise;
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
                    deferred.reject(tl.loc("FailedToAddRuleToNetworkSecurityGroup", securityGrpName));
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
                }

                if (result.length > 0) {
                    tl.debug("Got network security group " + securityGrpName + " in resource group " + this.resourceGroupName);
                    if (retryCnt > 0) {
                        await this.AddInboundNetworkSecurityRule(retryCnt - 1, securityGrpName, networkClient, ruleName, rulePriority, winrmHttpsPort);
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
                    await this.AddInboundNetworkSecurityRule(maxRetries, securityGrpName, networkClient, ruleName, rulePriority, winrmHttpsPort);
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

        try {
            var networkClient = new networkManagementClient.NetworkManagementClient(this.credentials, this.subscriptionId);
            networkClient.networkSecurityGroups.list(this.resourceGroupName, null, async (error, result, request, response) => {
                if (error) {
                    tl.debug("Error in getting the list of network Security Groups for the resource-group" + this.resourceGroupName + "error" + util.inspect(error, { depth: null }));
                    this.ruleAddedToNsg = true;
                    deferred.reject(tl.loc("FetchingOfNetworkSecurityGroupFailed", error));
                }

                if (result.length > 0) {
                    tl.debug("Trying to add a network security group rule");
                    await this.AddNetworkSecurityRuleConfig(result, _ruleName, _rulePriority, _winrmHttpsPort);
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

        try {
            /*
            Steps:
                1. Check if CustomScriptExtension exists.
                2. If not install it
                3.Add the inbound rule to allow traffic on winrmHttpsPort
            */
            var computeClient = new computeManagementClient.ComputeManagementClient(this.credentials, this.subscriptionId);
            tl.debug("Checking if the extension " + _extensionName + " is present on vm " + vmName);

            computeClient.virtualMachineExtensions.get(this.resourceGroupName, vmName, _extensionName, async (error, result, request, response) => {
                if (error) {
                    tl.debug("Failed to get the extension!!");
                    //Adding the extension
                    await this.AddExtensionVM(vmName, computeClient, dnsName, _extensionName, location, fileUris);
                }
                else if (result != null) {
                    console.log(tl.loc("ExtensionAlreadyPresentVm", _extensionName, vmName));
                    tl.debug("Checking if the Custom Script Extension enables Https Listener for winrm on VM " + vmName);
                    if (result["properties"]["settings"]["fileUris"].length == fileUris.length && fileUris.every((element, index) => { return element === result["properties"]["settings"]["fileUris"][index]; })) {
                        tl.debug("Custom Script extension is for enabling Https Listener on VM" + vmName);
                        if (result["properties"]["provisioningState"] != 'Succeeded') {
                            tl.debug("Provisioning State of extension " + _extensionName + " on vm " + vmName + " is not Succeeded");
                            await this.RemoveExtensionFromVM(_extensionName, vmName, computeClient);
                            await this.AddExtensionVM(vmName, computeClient, dnsName, _extensionName, location, fileUris);
                        }
                        else {
                            //Validate the Custom Script Execution status: if ok add the rule else add the extension
                            await this.ValidateCustomScriptExecutionStatus(vmName, computeClient, dnsName, _extensionName, location, fileUris);
                        }
                    }
                    else {
                        tl.debug("Custom Script Extension present doesn't enable Https Listener on VM" + vmName);
                        await this.AddExtensionVM(vmName, computeClient, dnsName, _extensionName, location, fileUris);
                    }
                }
                else {
                    deferred.reject(tl.loc("FailedToAddExtension"));
                }
                deferred.resolve("");
            });
        }
        catch (exception) {
            deferred.reject(tl.loc("ARG_DeploymentPrereqFailed", exception.message));
        }

        return deferred.promise;
    }

    private async ValidateCustomScriptExecutionStatus(vmName: string, computeClient, dnsName: string, extensionName: string, location: string, fileUris) {
        tl.debug("Validating the winrm configuration custom script extension status");
        var deferred = Q.defer<void>();

        computeClient.virtualMachines.get(this.resourceGroupName, vmName, { expand: 'instanceView' }, async (error, result, request, response) => {
            if (error) {
                tl.debug("Error in getting the instance view of the virtual machine " + util.inspect(error, { depth: null }));
                deferred.reject(tl.loc("FailedToFetchInstanceViewVM"));
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

            if (invalidExecutionStatus) {
                await this.AddExtensionVM(vmName, computeClient, dnsName, extensionName, location, fileUris);
            }
            else {
                this.customScriptExtensionInstalled = true;
                tl.debug("Status of the customScriptExtension is valid on VM " + vmName);
            }
            deferred.resolve(null);
        });
        return deferred.promise;
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
            }

            tl.debug("Addition of extension completed for vm" + vmName);
            if (result["properties"]["provisioningState"] != 'Succeeded') {
                tl.debug("Provisioning State of CustomScriptExtension is not suceeded on vm " + vmName);
                await this.RemoveExtensionFromVM(extensionName, vmName, computeClient);
                deferred.reject(tl.loc("ARG_SetExtensionFailedForVm", this.resourceGroupName, vmName, result));
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
            }
            else {
                tl.debug("Successfully removed the extension " + extensionName + " from the VM " + vmName);
            }
            deferred.resolve(null);
        });

        return deferred.promise;
    }

    private async SetAzureRMVMsConnectionDetailsInResourceGroup() {
        var vmResourceDetails = {};
        var debugLogsFlag = process.env["SYSTEM_DEBUG"];
        var networkClient = new networkManagementClient.NetworkManagementClient(this.credentials, this.subscriptionId);
        var computeClient = new computeManagementClient.ComputeManagementClient(this.credentials, this.subscriptionId);
        var deferred = Q.defer<string>();

        var virtualMachines = await this.azureUtils.getVMDetails();
        var publicIPAddresses = await this.azureUtils.getPublicIPAddresses();
        var networkInterfaces = await this.azureUtils.getNetworkInterfaceDetails();
        var result = await this.azureUtils.getLoadBalancers();
        if (result.length > 0) {
            for (var i = 0; i < result.length; i++) {
                var lbName = result[i]["name"];
                var frontEndIPConfigs = result[i]["properties"]["frontendIPConfigurations"];
                var inboundRules = result[i]["properties"]["inboundNatRules"];

                this.fqdnMap = this.GetMachinesFqdnForLB(publicIPAddresses, networkInterfaces, frontEndIPConfigs, this.fqdnMap, debugLogsFlag);

                this.winRmHttpsPortMap = this.GetFrontEndPorts("5986", this.winRmHttpsPortMap, networkInterfaces, inboundRules, debugLogsFlag);
            }

            this.winRmHttpsPortMap = this.GetMachineNameFromId(this.winRmHttpsPortMap, "Front End port", virtualMachines, false, debugLogsFlag);
        }

        this.fqdnMap = this.GetMachinesFqdnsForPublicIP(publicIPAddresses, networkInterfaces, virtualMachines, this.fqdnMap, debugLogsFlag);

        this.fqdnMap = this.GetMachineNameFromId(this.fqdnMap, "FQDN", virtualMachines, true, debugLogsFlag);

        tl.debug("FQDN map: ");
        for (var index in this.fqdnMap) {
            tl.debug(index + " : " + this.fqdnMap[index]);
        }

        tl.debug("WinRMHttpPort map: ");
        for (var index in this.winRmHttpsPortMap) {
            tl.debug(index + " : " + this.winRmHttpsPortMap[index]);
        }

        this.virtualMachines = virtualMachines;

        deferred.resolve("");
        return deferred.promise;
    }

    private GetMachinesFqdnsForPublicIP(publicIPAddressResources: [Object], networkInterfaceResources: [Object], azureRMVMResources: [Object], fqdnMap: {}, debugLogsFlag: string): {} {
        if (!!this.resourceGroupName && this.resourceGroupName != "" && !!publicIPAddressResources && networkInterfaceResources) {
            tl.debug("Trying to get FQDN for the azureRM VM resources under public IP from resource group " + this.resourceGroupName);

            //Map the ipc to fqdn
            for (var i = 0; i < publicIPAddressResources.length; i++) {
                var publicIp = publicIPAddressResources[i];
                if (!!publicIp["properties"]["ipConfiguration"] && !!publicIp["properties"]["ipConfiguration"]["id"] && publicIp["properties"]["ipConfiguration"]["id"] != "") {
                    if (!!publicIp["properties"]["dnsSettings"] && !!publicIp["properties"]["dnsSettings"]["fqdn"] && publicIp["properties"]["dnsSettings"]["fqdn"] != "") {
                        fqdnMap[publicIp["properties"]["ipConfiguration"]["id"]] = publicIp["properties"]["dnsSettings"]["fqdn"];
                    }
                    else if (!!publicIp["properties"]["ipAddress"] && publicIp["properties"]["ipAddress"] != "") {
                        fqdnMap[publicIp["properties"]["ipConfiguration"]["id"]] = publicIp["properties"]["ipAddress"];
                    }
                    else if (!publicIp["properties"]["ipAddress"]) {
                        fqdnMap[publicIp["properties"]["ipConfiguration"]["id"]] = "Not Assigned";
                    }
                }
            }

            //Find out the NIC and thus the VM corresponding to a given ipc
            for (var i = 0; i < networkInterfaceResources.length; i++) {
                var nic = networkInterfaceResources[i];
                if (!!nic["properties"]["ipConfigurations"]) {
                    for (var j = 0; j < nic["properties"]["ipConfigurations"].length; j++) {
                        var ipc = nic["properties"]["ipConfigurations"][j];
                        if (!!ipc["id"] && ipc["id"] != "") {
                            var fqdn = fqdnMap[ipc["id"]];
                            if (!!fqdn && fqdn != "") {
                                delete fqdnMap[ipc["id"]];
                                if (!!nic["properties"]["virtualMachine"] && !!nic["properties"]["virtualMachine"]["id"] && nic["properties"]["virtualMachine"]["id"] != "") {
                                    fqdnMap[nic["properties"]["virtualMachine"]["id"]] = fqdn;
                                }
                            }
                        }
                    }
                }
            }
        }
        return fqdnMap;
    }

    private GetMachineNameFromId(map: {}, mapParameter: string, azureRMVMResources: [Object], throwOnTotalUnavailability: boolean, debugLogsFlag: string): {} {
        if (!!map) {
            if (debugLogsFlag == "true") {
                //fill here
            }

            tl.debug("throwOnTotalUnavailability: " + throwOnTotalUnavailability);

            var errorCount = 0;
            for (var i = 0; i < azureRMVMResources.length; i++) {
                var vm = azureRMVMResources[i];
                if (vm["id"] && vm["id"] != "") {
                    var value = map[vm["id"]];
                    var resourceName = vm["name"];
                    if (value && value != "") {
                        tl.debug(mapParameter + " value for resource " + resourceName + " is " + value);
                        delete map[vm["id"]];
                        map[resourceName] = value;
                    }
                    else {
                        errorCount = errorCount + 1;
                        tl.debug("Unable to find " + mapParameter + " for resource " + resourceName);
                    }
                }
            }

            if (throwOnTotalUnavailability === true) {
                if (errorCount == azureRMVMResources.length && azureRMVMResources.length != 0) {
                    throw tl.loc("ARG_AllResourceNotFound", mapParameter, this.resourceGroupName);
                }
                else {
                    if (errorCount > 0 && errorCount != azureRMVMResources.length) {
                        console.warn(tl.loc("ARG_ResourceNotFound", mapParameter, errorCount, this.resourceGroupName));
                    }
                }
            }
        }

        return map;
    }

    private GetFrontEndPorts(backEndPort: string, portList: {}, networkInterfaceResources: [Object], inboundRules: [Object], debugLogsFlag: string): {} {
        if (!!backEndPort && backEndPort != "" && !!networkInterfaceResources && !!inboundRules) {
            tl.debug("Trying to get front end ports for " + backEndPort);

            for (var i = 0; i < inboundRules.length; i++) {
                var rule = inboundRules[i];
                if (rule["properties"]["backendPort"] == backEndPort && !!rule["properties"]["backendIPConfiguration"] && !!rule["properties"]["backendIPConfiguration"]["id"] && rule["properties"]["backendIPConfiguration"]["id"] != "") {
                    portList[rule["properties"]["backendIPConfiguration"]["id"]] = rule["properties"]["frontendPort"];
                }
            }

            //get the nic and the corrresponding machine id for a given back end ipc
            for (var i = 0; i < networkInterfaceResources.length; i++) {
                var nic = networkInterfaceResources[i];
                if (!!nic["properties"]["ipConfigurations"]) {
                    for (var j = 0; j < nic["properties"]["ipConfigurations"].length; j++) {
                        var ipc = nic["properties"]["ipConfigurations"][j];
                        if (!!ipc && !!ipc["id"] && ipc["id"] != "") {
                            var frontendPort = portList[ipc["id"]];
                            if (!!frontendPort && frontendPort != "") {
                                delete portList[ipc["id"]];
                                if (!!nic["properties"]["virtualMachine"] && !!nic["properties"]["virtualMachine"]["id"] && nic["properties"]["virtualMachine"]["id"] != "") {
                                    portList[nic["properties"]["virtualMachine"]["id"]] = frontendPort;
                                }
                            }
                        }
                    }
                }
            }

        }

        return portList;
    }

    private GetMachinesFqdnForLB(publicIPAddress: [Object], networkInterfaceResources: [Object], frontEndIPConfigs: [Object], fqdnMap: {}, debugLogsFlag: string): {} {
        if (this.resourceGroupName && this.resourceGroupName != "" && publicIPAddress && networkInterfaceResources && frontEndIPConfigs) {
            tl.debug("Trying to get the FQDN for the azureVM resources under load balancer from resource group " + this.resourceGroupName);

            for (var i = 0; i < publicIPAddress.length; i++) {
                var publicIp = publicIPAddress[i];
                if (!!publicIp["properties"]["ipConfiguration"] && !!publicIp["properties"]["ipConfiguration"]["id"] && publicIp["properties"]["ipConfiguration"]["id"] != "") {
                    if (!!publicIp["properties"]["dnsSettings"] && !!publicIp["properties"]["dnsSettings"]["fqdn"] && publicIp["properties"]["dnsSettings"]["fqdn"] != "") {
                        fqdnMap[publicIp["id"]] = publicIp["properties"]["dnsSettings"]["fqdn"];
                    }
                    else if (!!publicIp["properties"]["ipAddress"] && publicIp["properties"]["ipAddress"] != "") {
                        fqdnMap[publicIp["id"]] = publicIp["properties"]["ipAddress"];
                    }
                    else if (!publicIp["properties"]["ipAddress"]) {
                        fqdnMap[publicIp["id"]] = "Not Assigned";
                    }
                }
            }

            //Get the NAT rule for a given ip id
            for (var i = 0; i < frontEndIPConfigs.length; i++) {
                var config = frontEndIPConfigs[i];
                if (config["properties"]["publicIPAddress"] && config["properties"]["publicIPAddress"]["id"] && config["properties"]["publicIPAddress"]["id"] != "") {
                    var fqdn = fqdnMap[config["properties"]["publicIPAddress"]["id"]];
                    if (fqdn && fqdn != "") {
                        delete fqdnMap[config["properties"]["publicIPAddress"]["id"]];
                        if (!!config["properties"]["inboundNatRules"]) {
                            for (var j = 0; j < config["properties"]["inboundNatRules"].length; j++) {
                                fqdnMap[config["properties"]["inboundNatRules"][j]["id"]] = fqdn;
                            }
                        }
                    }
                }
            }

            for (var i = 0; i < networkInterfaceResources.length; i++) {
                var nic = networkInterfaceResources[i];
                if (nic["properties"]["ipConfigurations"]) {
                    for (var j = 0; j < nic["properties"]["ipConfigurations"].length; j++) {
                        var ipc = nic["properties"]["ipConfigurations"][j];
                        if (ipc["properties"]["loadBalancerInboundNatRules"]) {
                            for (var k = 0; k < ipc["properties"]["loadBalancerInboundNatRules"].length; k++) {
                                var rule = ipc["properties"]["loadBalancerInboundNatRules"][k];
                                if (rule && rule["id"] && rule["id"] != "") {
                                    var fqdn = fqdnMap[rule["id"]];
                                    if (fqdn && fqdn != "") {
                                        delete fqdnMap[rule["id"]];
                                        if (nic["properties"]["virtualMachine"] && nic["properties"]["virtualMachine"]["id"] && nic["properties"]["virtualMachine"]["id"] != "") {
                                            fqdnMap[nic["properties"]["virtualMachine"]["id"]] = fqdn;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        return fqdnMap;
    }
}