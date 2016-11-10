var networkManagementClient = require("azure-arm-network");
var computeManagementClient = require("azure-arm-compute");
import util = require("util");
import tl = require("vsts-task-lib/task");

export class WinRMHttpsListener {
    private resourceGroupName: string;
    private credentials;
    private subscriptionId: string;
    private enablePrereq: boolean;
    private fqdnMap;
    private winRmHttpsPortMap;
    private virtualMachines;
    private customScriptExtensionInstalled: boolean;
    private ruleAddedToNsg: boolean;

    constructor(resourceGroupName: string, credentials, subscriptionId: string, enablePrereq: boolean) {
        this.resourceGroupName = resourceGroupName;
        this.credentials = credentials;
        this.subscriptionId = subscriptionId;
        this.enablePrereq = enablePrereq;
        this.fqdnMap = {};
        this.winRmHttpsPortMap = {};
        this.customScriptExtensionInstalled = false;
        this.ruleAddedToNsg = false;
        return this;
    }

    public EnableWinRMHttpsListener() {
        this.SetAzureRMVMsConnectionDetailsInResourceGroup(this.enablePrereq, () => {
            try {
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

                    if (this.enablePrereq === true) {
                        tl.debug("Enabling winrm for virtual machine " + resourceName);
                        this.AddAzureVMCustomScriptExtension(resourceId, resourceName, resourceFQDN, vm["location"]);
                    }
                }

                if (this.enablePrereq === true) {
                    this.AddWinRMHttpsNetworkSecurityRuleConfig();
                }
            }
            catch (exception) {
                console.log(tl.loc("FailedToEnablePrereqs", [exception.message]))
            }
        });
    }

    private AddRule(lb, frontendPortMap) {
        var ruleIdMap = {};
        var lbName = lb["name"];
        var addedRulesId = [];

        var networkClient = new networkManagementClient(this.credentials, this.subscriptionId);

        tl.debug("Updating the load balancers with the appropriate Inbound Nat rules");

        networkClient.loadBalancers.createOrUpdate(this.resourceGroupName, lbName, { "frontendIPConfigurations": lb["frontendIPConfigurations"], "inboundNatRules": lb["inboundNatRules"], "location": lb["location"], "backendAddressPools": lb["backendAddressPools"] }, (error, result, request, response) => {
            if (error) {
                tl.debug("Failed with error " + util.inspect(error, { depth: null }));
                throw tl.loc("FailedToUpdateInboundNatRuleLB", [lbName]);
            }
            console.log(tl.loc("AddedInboundNatRuleLB", [lbName]));

            var addedRulesId = [];

            for (var rule of result["inboundNatRules"]) {
                var index = rule["frontendPort"].toString();
                var ipc = frontendPortMap[index];

                if (!!ipc && ipc != "") {
                    if (!ruleIdMap[ipc]) {
                        ruleIdMap[ipc] = [];
                    }
                    ruleIdMap[ipc].push(rule["id"]);
                    addedRulesId.push(rule["id"]);
                }
            }

            console.log("Added rules id are:");
            for (var id of addedRulesId) {
                console.log("Id: %s", id);
            }

            networkClient.networkInterfaces.list(this.resourceGroupName, (error, networkInterfaces, request, response) => {
                if (error) {
                    tl.debug("Error in fetching the list of network Interfaces " + util.inspect(error, { depth: null }));
                    throw new Error(tl.loc("FailedToFetchNetworkInterfaces"));
                }

                for (var nic of networkInterfaces) {
                    var flag: boolean = false;
                    for (var ipc of nic["ipConfigurations"]) {
                        if (!!ruleIdMap[ipc["id"]] && ruleIdMap[ipc["id"]] != "") {
                            for (var rule of ruleIdMap[ipc["id"]]) {
                                if (!ipc["loadBalancerInboundNatRules"]) {
                                    ipc["loadBalancerInboundNatRules"] = [];
                                }
                                ipc["loadBalancerInboundNatRules"].push({ "id": rule });
                                location = nic["location"];
                                flag = true;
                            }
                        }
                    }
                    if (!!flag) {
                        tl.debug("Updating the NIC of the concerned vms");
                        networkClient.networkInterfaces.createOrUpdate(this.resourceGroupName, nic["name"], { "ipConfigurations": nic["ipConfigurations"], "location": nic["location"] }, (error, res, response, request) => {
                            if (error) {
                                tl.debug("Error in updating the list of Network Interfaces: " + util.inspect(error, { depth: null }));
                                throw new Error("FailedToUpdateNICOfVm");
                            }
                            tl.debug("Result of updating network interfaces: " + util.inspect(res, { depth: null }));
                            console.log(tl.loc("AddedTargetInboundNatRuleLB", [lbName]));

                            //Remove the rules which has no target virtual machines
                            this.removeIrrelevantRules(lb, networkClient, addedRulesId);
                        });
                    }
                }
            });
        });
    }

    private removeIrrelevantRules(lb, networkClient, addedRulesId) {
        var lbName = lb["name"];
        networkClient.loadBalancers.get(this.resourceGroupName, lbName, (error, lbDetails, request, response) => {
            if (error) {
                tl.debug("Error in getting the details of the load Balancer: " + lbName);
                throw new Error("Error in getting the details of the load Balnacer " + lbName);
            }

            var updateRequired = false;
            var relevantRules = [];

            if (lbDetails["inboundNatRules"]) {
                for (var rule of lbDetails["inboundNatRules"]) {
                    if (addedRulesId.find((x) => x == rule["id"])) {
                        if (rule["backendPort"] === 5986 && rule["backendIPConfiguration"] && rule["backendIPConfiguration"]["id"] && rule["backendIPConfiguration"]["id"] != "") {
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
                networkClient.loadBalancers.createOrUpdate(this.resourceGroupName, lbName, { "frontendIPConfigurations": lb["frontendIPConfigurations"], "inboundNatRules": relevantRules, "location": lb["location"], "backendAddressPools": lb["backendAddressPools"] }, (error, result, request, response) => {
                    if (error) {
                        tl.debug("Failed to update the inbound Nat rules of Load balancer " + lbName + "to remove irrelevant rules");
                        throw new Error("Failed to update LB inbound Nat rules");
                    }
                    tl.debug("Successfully Updated the inbound Nat Rules: " + util.inspect(result, { depth: null }));
                });
            }
        });
    }

    public AddInboundNatRuleLB() {
        var inboundWinrmHttpPort = {};
        var networkClient = new networkManagementClient(this.credentials, this.subscriptionId);
        console.log("Adding Inbound Nat Rule for LB");
        networkClient.loadBalancers.list(this.resourceGroupName, (error, loadBalancers, request, response) => {
            if (error) {
                tl.debug("Failed to fetch the list of load balancers with error " + util.inspect(error, { depth: null }));
                throw new Error("FailedToFetchLoadBalancers");
            }
            for (var lb of loadBalancers) {
                /*1. Find all the busy ports
                  2. Find the vms which are in backend Pools but their winRMPort is not mapped
                  3. Next add the inbound NAT rules
                */
                var vmsInBackendPool = {};
                var UnallocatedVMs = [];
                var usedPorts = [];
                var lbName = lb["name"];

                //console.log(lb["name"]);
                var pools = lb["backendAddressPools"];
                for (var pool of pools) {
                    //console.log("pool: %s", util.inspect(pool, { depth: null }));
                    if (pool && pool["backendIPConfigurations"]) {
                        var ipConfigs = pool["backendIPConfigurations"];
                        for (var ipc of ipConfigs) {
                            vmsInBackendPool[ipc["id"]] = "Exists";
                        }
                    }
                }

                for (var rule of lb["inboundNatRules"]) {
                    usedPorts.push(rule["frontendPort"]);
                    if (rule["backendPort"] === 5986 && rule["backendIPConfiguration"] && rule["backendIPConfiguration"]["id"]) {
                        if (!!vmsInBackendPool[rule["backendIPConfiguration"]["id"]] && vmsInBackendPool[rule["backendIPConfiguration"]["id"]] === "Exists") {
                            delete vmsInBackendPool[rule["backendIPConfiguration"]["id"]];
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
                        "backendPort": 5986,
                        "frontendPort": vmsInBackendPool[key],
                        "frontendIPConfiguration": { "id": lb["frontendIPConfigurations"][0]["id"] },
                        "protocol": "Tcp",
                        "idleTimeoutInMinutes": 4,
                        "enableFloatingIP": false,
                    };
                    lb["inboundNatRules"].push(newRule);
                }
                var ruleIdMap = {};
                if (!empty) {
                    this.AddRule(lb, frontendPortMap);
                }
                else {
                    tl.debug("No vms left for adding inbound nat rules for load balancer " + lbName);
                    console.log(tl.loc("InboundNatRuleLBPresent", lbName));
                }
            }
        });
    }

    private AddInboundNetworkSecurityRule(retryCnt: number, securityGrpName, networkClient, ruleName, rulePriority, winrmHttpsPort) {
        try {
            tl.debug("Adding inbound network security rule config " + ruleName + " with priority " + rulePriority + " for port " + winrmHttpsPort + " under security group " + securityGrpName);
            var securityRuleParameters = { direction: "Inbound", access: "Allow", sourceAddressPrefix: "*", sourcePortRange: "*", destinationAddressPrefix: "*", destinationPortRange: winrmHttpsPort, protocol: "*", priority: rulePriority };

            var networkClient1 = new networkManagementClient(this.credentials, this.subscriptionId);
            networkClient1.securityRules.createOrUpdate(this.resourceGroupName, securityGrpName, ruleName, securityRuleParameters, (error, result, request, response) => {
                if (error) {
                    tl.debug("Error in adding network security rule " + util.inspect(error, { depth: null }));
                    throw tl.loc("FailedToAddRuleToNetworkSecurityGroup", [securityGrpName]);
                }
                console.log(tl.loc("AddedSecurityRuleNSG", [ruleName, rulePriority, winrmHttpsPort, securityGrpName, util.inspect(result, { depth: null })]));
                this.ruleAddedToNsg = true;
            });
        }
        catch (exception) {
            tl.debug("Failed to add inbound network security rule config " + ruleName + " with priority " + rulePriority + " for port " + winrmHttpsPort + " under security group " + securityGrpName + " : " + exception.message);
            rulePriority = rulePriority + 50;
            tl.debug("Getting network security group" + securityGrpName + " in resource group " + this.resourceGroupName);

            networkClient.networkSecurityGroups.list(this.resourceGroupName, (error, result, request, response) => {
                if (error) {
                    tl.debug("Error in getting the list of network Security Groups for the resource-group " + this.resourceGroupName);
                    throw tl.loc("FetchingOfNetworkSecurityGroupFailed");
                }

                if (result.length > 0) {
                    tl.debug("Got network security group " + securityGrpName + " in resource group " + this.resourceGroupName);
                    if (retryCnt > 0) {
                        this.AddInboundNetworkSecurityRule(retryCnt - 1, securityGrpName, networkClient, ruleName, rulePriority, winrmHttpsPort);
                    }
                    else {
                        tl.debug("Failed to add the NSG rule on security group " + securityGrpName + " after trying for 3 times ");
                        throw tl.loc("FailedAddingNSGRule3Times", [securityGrpName]);
                    }
                }
            });
        }
    }

    private TryAddNetworkSecurityRule(securityGrpName, ruleName, rulePriority: number, winrmHttpsPort: string) {
        var networkClient = new networkManagementClient(this.credentials, this.subscriptionId);
        try {
            networkClient.securityRules.get(this.resourceGroupName, securityGrpName, ruleName, (error, result, request, response) => {
                if (error) {
                    tl.debug("Rule " + ruleName + " not found under security Group " + securityGrpName);
                    var maxRetries = 3;
                    this.AddInboundNetworkSecurityRule(maxRetries, securityGrpName, networkClient, ruleName, rulePriority, winrmHttpsPort);
                }
                else {
                    console.log(tl.loc("RuleExistsAlready", [ruleName, securityGrpName]));
                    this.ruleAddedToNsg = true;
                    //call the function
                }
            });
        }
        catch (exception) {
            throw tl.loc("FailedToAddRuleToNetworkSecurityGroup", [securityGrpName]);
        }
    }

    private AddNetworkSecurityRuleConfig(securityGroups: [Object], ruleName: string, rulePriority: number, winrmHttpsPort: string) {
        for (var i = 0; i < securityGroups.length; i++) {
            console.log(tl.loc("AddingSecurityRuleNSG", [securityGroups[i]["name"]]));
            var securityGrp = securityGroups[i];
            var securityGrpName = securityGrp["name"];

            try {
                tl.debug("Getting the network security rule config " + ruleName + " under security group " + securityGrpName);
                this.TryAddNetworkSecurityRule(securityGrpName, ruleName, rulePriority, winrmHttpsPort);
            }
            catch (exception) {
                tl.debug("Failed to add the network security rule with exception: " + exception.message);
                throw tl.loc("FailedToAddNetworkSecurityRule", [securityGrpName]);
            }
        }
    }

    private AddWinRMHttpsNetworkSecurityRuleConfig() {
        tl.debug("Trying to add a network security group rule");

        var _ruleName: string = "VSO-Custom-WinRM-Https-Port";
        var _rulePriority: number = 3986;
        var _winrmHttpsPort: string = "5986";

        try {
            var networkClient = new networkManagementClient(this.credentials, this.subscriptionId);
            networkClient.networkSecurityGroups.list(this.resourceGroupName, (error, result, request, response) => {
                if (error) {
                    tl.debug("Error in getting the list of network Security Groups for the resource-group" + this.resourceGroupName + "error" + util.inspect(error, { depth: null }));
                    this.ruleAddedToNsg = true;
                    throw new Error(tl.loc("FetchingOfNetworkSecurityGroupFailed"));
                }

                if (result.length > 0) {
                    this.AddNetworkSecurityRuleConfig(result, _ruleName, _rulePriority, _winrmHttpsPort);
                }
            });
        }
        catch (exception) {
            this.ruleAddedToNsg = true;
            throw new Error(tl.loc("ARG_NetworkSecurityConfigFailed", [exception.message]));
        }
    }

    private AddAzureVMCustomScriptExtension(vmId: string, vmName: string, dnsName: string, location: string) {
        var _extensionName: string = "CustomScriptExtension";

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
            var computeClient = new computeManagementClient(this.credentials, this.subscriptionId);

            tl.debug("Checking if the extension " + _extensionName + " is present on vm " + vmName);

            computeClient.virtualMachineExtensions.get(this.resourceGroupName, vmName, _extensionName, (error, result, request, response) => {
                if (error) {
                    tl.debug("Failed to get the extension!!");
                    //Adding the extension
                    this.AddExtensionVM(vmName, computeClient, dnsName, _extensionName, location);
                }
                else if (result != null) {
                    console.log(tl.loc("ExtensionAlreadyPresentVm ", [_extensionName, vmName]));
                    if (result["provisioningState"] != 'Succeeded') {
                        tl.debug("Provisioning State of extension " + _extensionName + " on vm " + vmName + " is not Succeeded");
                        this.RemoveExtensionFromVM(_extensionName, vmName, computeClient);
                        this.AddExtensionVM(vmName, computeClient, dnsName, _extensionName, location);
                    }
                    else {
                        //Validate the Custom Script Execution status: if ok add the rule else add the extension
                        this.ValidateCustomScriptExecutionStatus(vmName, computeClient, dnsName, _extensionName, location);
                    }
                }
                else {
                    throw tl.loc("FailedToAddExtension");
                }
            });
        }
        catch (exception) {
            throw tl.loc("ARG_DeploymentPrereqFailed", [exception.message]);
        }
    }

    private ValidateCustomScriptExecutionStatus(vmName: string, computeClient, dnsName: string, extensionName: string, location: string) {
        tl.debug("Validating the winrm configuration custom script extension status");

        computeClient.virtualMachines.get(this.resourceGroupName, vmName, { expand: 'instanceView' }, (error, result, request, response) => {
            if (error) {
                tl.debug("Error in getting the instance view of the virtual machine " + util.inspect(error, { depth: null }));
                throw tl.loc("FailedToFetchInstanceViewVM");
            }

            var invalidExecutionStatus: boolean = false;
            var extensions = result["instanceView"]["extensions"];
            for (var i = 0; i < extensions.length; i++) {
                var extension = extensions[i];
                if (extension["name"] === extensionName) {
                    for (var j = 0; j < extension["substatuses"]; j++) {
                        var substatus = extension["substatuses"][j];
                        if (substatus["code"].include("ComponentStatus/StdErr") && !!substatus["message"] && substatus["message"] != "") {
                            invalidExecutionStatus = true;
                            break;
                        }
                    }
                }
            }
            if (invalidExecutionStatus) {
                this.AddExtensionVM(vmName, computeClient, dnsName, extensionName, location);
            }
            else {
                this.customScriptExtensionInstalled = true;
            }
        });
    }

    private AddExtensionVM(vmName: string, computeClient, dnsName: string, extensionName: string, location: string) {
        var _configWinRMScriptFile: string = "https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/201-vm-winrm-windows/ConfigureWinRM.ps1";
        var _makeCertFile: string = "https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/201-vm-winrm-windows/makecert.exe";
        var _winrmConfFile: string = "https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/201-vm-winrm-windows/winrmconf.cmd";
        var _commandToExecute: string = "powershell.exe -File ConfigureWinRM.ps1 " + dnsName;
        var _extensionType: string = 'Microsoft.Compute/virtualMachines/extensions';
        var _virtualMachineExtensionType: string = 'CustomScriptExtension';
        var _typeHandlerVersion: string = '1.7';
        var _publisher: string = 'Microsoft.Compute';

        var _protectedSettings = { commandToExecute: _commandToExecute };
        var parameters = { type: _extensionType, virtualMachineExtensionType: _virtualMachineExtensionType, typeHandlerVersion: _typeHandlerVersion, publisher: _publisher, location: location, settings: { fileUris: [_configWinRMScriptFile, _makeCertFile, _winrmConfFile] }, protectedSettings: _protectedSettings };
        console.log(tl.loc("AddExtension", [extensionName, vmName]));
        computeClient.virtualMachineExtensions.createOrUpdate(this.resourceGroupName, vmName, extensionName, parameters, (error, result, request, response) => {
            if (error) {
                tl.debug("Failed to add the extension " + util.inspect(error, { depth: null }));
                throw tl.loc("CreationOfExtensionFailed");
            }

            tl.debug("Addition of extension completed ");
            if (result["provisioningState"] != 'Succeeded') {
                this.RemoveExtensionFromVM(extensionName, vmName, computeClient);
                throw tl.loc("ARG_SetExtensionFailedForVm", [this.resourceGroupName, vmName, result]);
            }
            this.customScriptExtensionInstalled = true;
        });
    }

    private RemoveExtensionFromVM(extensionName, vmName, computeClient) {
        tl.debug("Removing the extension " + extensionName + "from vm " + vmName);
        //delete the extension
        computeClient.virtualMachineExtensions.deleteMethod(this.resourceGroupName, vmName, extensionName, (error, result, request, response) => {
            if (error) {
                tl.debug("Failed to delete the extension " + extensionName + " on the vm " + vmName + ", with error Message: " + util.inspect(error, { depth: null }));
                throw tl.loc("FailedToDeleteExtension");
            }
            else {
                tl.debug("Successfully removed the extension " + extensionName + " from the VM " + vmName);
            }
        });
    }

    private SetAzureRMVMsConnectionDetailsInResourceGroup(enablePrereqs: boolean, callback: { (): void; }) {
        var vmResourceDetails = {};

        var debugLogsFlag = process.env["SYSTEM_DEBUG"];

        var networkClient = new networkManagementClient(this.credentials, this.subscriptionId);
        var computeClient = new computeManagementClient(this.credentials, this.subscriptionId);

        computeClient.virtualMachines.list(this.resourceGroupName, (error, virtualMachines, request, response) => {
            if (error) {
                tl.debug("Error in getting the list of virtual Machines " + util.inspect(error, { depth: null }));
                throw new Error(tl.loc("FailedToFetchVMList"));
            }
            networkClient.publicIPAddresses.list(this.resourceGroupName, (error, publicIPAddresses, request, response) => {
                if (error) {
                    tl.debug("Error while getting list of Public Addresses " + util.inspect(error, { depth: null }));
                    throw new Error(tl.loc("FailedToFetchPublicAddresses"));
                }
                networkClient.networkInterfaces.list(this.resourceGroupName, (error, networkInterfaces, request, response) => {
                    if (error) {
                        tl.debug("Failed to get the list of networkInterfaces list " + util.inspect(error, { depth: null }));
                        throw new Error(tl.loc("FailedToFetchNetworkInterfaces"));
                    }
                    networkClient.loadBalancers.list(this.resourceGroupName, (error, result, request, response) => {
                        if (error) {
                            tl.debug("Error while getting the list of load Balancers " + util.inspect(error, { depth: null }));
                            throw new Error(tl.loc("FailedToFetchLoadBalancers"));
                        }
                        if (result.length > 0) {
                            for (var i = 0; i < result.length; i++) {
                                var lbName = result[i]["name"];
                                var frontEndIPConfigs = result[i]["frontendIPConfigurations"];
                                var inboundRules = result[i]["inboundNatRules"];

                                this.fqdnMap = this.GetMachinesFqdnForLB(publicIPAddresses, networkInterfaces, frontEndIPConfigs, this.fqdnMap, debugLogsFlag);

                                this.winRmHttpsPortMap = this.GetFrontEndPorts("5986", this.winRmHttpsPortMap, networkInterfaces, inboundRules, debugLogsFlag);
                            }

                            this.winRmHttpsPortMap = this.GetMachineNameFromId(this.winRmHttpsPortMap, "Front End port", virtualMachines, false, debugLogsFlag);
                        }

                        this.fqdnMap = this.GetMachinesFqdnsForPublicIP(publicIPAddresses, networkInterfaces, virtualMachines, this.fqdnMap, debugLogsFlag);

                        this.fqdnMap = this.GetMachineNameFromId(this.fqdnMap, "FQDN", virtualMachines, true, debugLogsFlag);

                        tl.debug("FQDN map: " + util.inspect(this.fqdnMap, { depth: null }));
                        tl.debug("WinRMHttpPort map: " + util.inspect(this.winRmHttpsPortMap, { depth: null }));

                        this.virtualMachines = virtualMachines;

                        callback();
                    });

                });

            });

        });
    }

    private GetMachinesFqdnsForPublicIP(publicIPAddressResources: [Object], networkInterfaceResources: [Object], azureRMVMResources: [Object], fqdnMap: {}, debugLogsFlag: string): {} {
        if (!!this.resourceGroupName && this.resourceGroupName != "" && !!publicIPAddressResources && networkInterfaceResources) {
            tl.debug("Trying to get FQDN for the azureRM VM resources under public IP from resource group " + this.resourceGroupName);

            //Map the ipc to fqdn
            for (var i = 0; i < publicIPAddressResources.length; i++) {
                var publicIp = publicIPAddressResources[i];
                if (!!publicIp["ipConfiguration"] && !!publicIp["ipConfiguration"]["id"] && publicIp["ipConfiguration"]["id"] != "") {
                    if (!!publicIp["dnsSettings"] && !!publicIp["dnsSettings"]["fqdn"] && publicIp["dnsSettings"]["fqdn"] != "") {
                        fqdnMap[publicIp["ipConfiguration"]["id"]] = publicIp["dnsSettings"]["fqdn"];
                    }
                    else if (!!publicIp["ipAddress"] && publicIp["ipAddress"] != "") {
                        fqdnMap[publicIp["ipConfiguration"]["id"]] = publicIp["ipAddress"];
                    }
                    else if (!publicIp["ipAddress"]) {
                        fqdnMap[publicIp["ipConfiguration"]["id"]] = "Not Assigned";
                    }
                }
            }
            if (debugLogsFlag === "true") {
                //fill here
            }

            //Find out the NIC and thus the VM corresponding to a given ipc
            for (var i = 0; i < networkInterfaceResources.length; i++) {
                var nic = networkInterfaceResources[i];
                if (!!nic["ipConfigurations"]) {
                    for (var j = 0; j < nic["ipConfigurations"].length; j++) {
                        var ipc = nic["ipConfigurations"][j];
                        if (!!ipc["id"] && ipc["id"] != "") {
                            var fqdn = fqdnMap[ipc["id"]];
                            if (!!fqdn && fqdn != "") {
                                delete fqdnMap[ipc["id"]];
                                if (!!nic["virtualMachine"] && !!nic["virtualMachine"]["id"] && nic["virtualMachine"]["id"] != "") {
                                    fqdnMap[nic["virtualMachine"]["id"]] = fqdn;
                                }
                            }
                        }
                    }
                }
            }

            if (debugLogsFlag == "true") {
                //fill here
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
                    throw tl.loc("ARG_AllResourceNotFound", [mapParameter, this.resourceGroupName]);
                }
                else {
                    if (errorCount > 0 && errorCount != azureRMVMResources.length) {
                        console.warn(tl.loc("ARG_ResourceNotFound", [mapParameter, errorCount, this.resourceGroupName]));
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
                if (rule["backendPort"] == backEndPort && !!rule["backendIPConfiguration"] && !!rule["backendIPConfiguration"]["id"] && rule["backendIPConfiguration"]["id"] != "") {
                    portList[rule["backendIPConfiguration"]["id"]] = rule["frontendPort"];
                }
            }
            if (debugLogsFlag === "true") {
                //fill here
            }

            //get the nic and the corrresponding machine id for a given back end ipc
            for (var i = 0; i < networkInterfaceResources.length; i++) {
                var nic = networkInterfaceResources[i];
                if (!!nic["ipConfigurations"]) {
                    for (var j = 0; j < nic["ipConfigurations"].length; j++) {
                        var ipc = nic["ipConfigurations"][j];
                        if (!!ipc && !!ipc["id"] && ipc["id"] != "") {
                            var frontendPort = portList[ipc["id"]];
                            if (!!frontendPort && frontendPort != "") {
                                delete portList[ipc["id"]];
                                if (!!nic["virtualMachine"] && !!nic["virtualMachine"]["id"] && nic["virtualMachine"]["id"] != "") {
                                    portList[nic["virtualMachine"]["id"]] = frontendPort;
                                }
                            }
                        }
                    }
                }
            }

            if (debugLogsFlag == "true") {
                //fill here
            }
        }

        return portList;
    }

    private GetMachinesFqdnForLB(publicIPAddress: [Object], networkInterfaceResources: [Object], frontEndIPConfigs: [Object], fqdnMap: {}, debugLogsFlag: string): {} {
        if (this.resourceGroupName && this.resourceGroupName != "" && publicIPAddress && networkInterfaceResources && frontEndIPConfigs) {
            tl.debug("Trying to get the FQDN for the azureVM resources under load balancer from resource group " + this.resourceGroupName);

            for (var i = 0; i < publicIPAddress.length; i++) {
                var publicIp = publicIPAddress[i];
                if (!!publicIp["ipConfiguration"] && !!publicIp["ipConfiguration"]["id"] && publicIp["ipConfiguration"]["id"] != "") {
                    if (!!publicIp["dnsSettings"] && !!publicIp["dnsSettings"]["fqdn"] && publicIp["dnsSettings"]["fqdn"] != "") {
                        fqdnMap[publicIp["id"]] = publicIp["dnsSettings"]["fqdn"];
                    }
                    else if (!!publicIp["ipAddress"] && publicIp["ipAddress"] != "") {
                        fqdnMap[publicIp["id"]] = publicIp["ipAddress"];
                    }
                    else if (!publicIp["ipAddress"]) {
                        fqdnMap[publicIp["id"]] = "Not Assigned";
                    }
                }
            }

            if (debugLogsFlag === "true") {
                //fill here
            }

            //Get the NAT rule for a given ip id
            for (var i = 0; i < frontEndIPConfigs.length; i++) {
                var config = frontEndIPConfigs[i];
                if (config["publicIPAddress"] && config["publicIPAddress"]["id"] && config["publicIPAddress"]["id"] != "") {
                    var fqdn = fqdnMap[config["publicIPAddress"]["id"]];
                    if (fqdn && fqdn != "") {
                        delete fqdnMap[config["publicIPAddress"]["id"]];
                        if (!!config["inboundNatRules"]) {
                            for (var j = 0; j < config["inboundNatRules"].length; j++) {
                                fqdnMap[config["inboundNatRules"][j]["id"]] = fqdn;
                            }
                        }
                    }
                }
            }

            if (debugLogsFlag === "true") {
                //fill here
            }

            for (var i = 0; i < networkInterfaceResources.length; i++) {
                var nic = networkInterfaceResources[i];
                if (nic["ipConfigurations"]) {
                    for (var j = 0; j < nic["ipConfigurations"].length; j++) {
                        var ipc = nic["ipConfigurations"][j];
                        if (ipc["loadBalancerInboundNatRules"]) {
                            for (var k = 0; k < ipc["loadBalancerInboundNatRules"].length; k++) {
                                var rule = ipc["loadBalancerInboundNatRules"][k];
                                if (rule && rule["id"] && rule["id"] != "") {
                                    var fqdn = fqdnMap[rule["id"]];
                                    if (fqdn && fqdn != "") {
                                        delete fqdnMap[rule["id"]];
                                        if (nic["virtualMachine"] && nic["virtualMachine"]["id"] && nic["virtualMachine"]["id"] != "") {
                                            fqdnMap[nic["virtualMachine"]["id"]] = fqdn;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (debugLogsFlag === "true") {
                //fill here
            }
        }

        return fqdnMap;
    }
}