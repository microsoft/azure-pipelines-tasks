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

    constructor(resourceGroupName: string, credentials, subscriptionId: string, enablePrereq: boolean) {
        this.resourceGroupName = resourceGroupName;
        this.credentials = credentials;
        this.subscriptionId = subscriptionId;
        this.enablePrereq = enablePrereq;
        this.fqdnMap = {};
        this.winRmHttpsPortMap = {};
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
                        console.log("Defaulting WinRmHttpsPort of %s to 5986", resourceName);
                        this.winRmHttpsPortMap[resourceName] = "5986";
                    }

                    if (this.enablePrereq === true) {
                        console.log("Enabling winrm for virtual machine %s", resourceName);
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

    private AddInboundNetworkSecurityRule(retryCnt: number, securityGrpName, networkClient, ruleName, rulePriority, winrmHttpsPort) {
        try {
            console.log("Adding inbound network security rule config %s with priority %s for port %s under security group %s", ruleName, rulePriority, winrmHttpsPort, securityGrpName);
            var securityRuleParameters = { direction: "Inbound", access: "Allow", sourceAddressPrefix: "*", sourcePortRange: "*", destinationAddressPrefix: "*", destinationPortRange: winrmHttpsPort, protocol: "*", priority: rulePriority };

            var networkClient1 = new networkManagementClient(this.credentials, this.subscriptionId);
            networkClient1.securityRules.createOrUpdate(this.resourceGroupName, securityGrpName, ruleName, securityRuleParameters, (error, result, request, response) => {
                if (error) {
                    console.log("Error in adding network security rule %s", util.inspect(error, { depth: null }));
                    throw "FailedToAddRuleToNetworkSecurityGroup";
                }
                console.log("Added inbound network security rule config %s with priority %s for port %s under security group %s with result: %s", ruleName, rulePriority, winrmHttpsPort, securityGrpName, util.inspect(result, { depth: null }));
            });
        }
        catch (exception) {
            console.log("Failed to add inbound network security rule config %s with priority %s for port %s under security group %s: %s", ruleName, rulePriority, winrmHttpsPort, securityGrpName, exception.message);
            rulePriority = rulePriority + 50;
            console.log("Getting network security group %s in resource group %s", securityGrpName, this.resourceGroupName);

            networkClient.networkSecurityGroups.list(this.resourceGroupName, (error, result, request, response) => {
                if (error) {
                    console.log("Error in getting the list of network Security Groups for the resource-group %s", this.resourceGroupName);
                    throw "FetchingOfNetworkSecurityGroupFailed";
                }

                if (result.length > 0) {
                    console.log("Got network security group %s in resource group %s", securityGrpName, this.resourceGroupName);
                    if (retryCnt > 0) {
                        retryCnt = retryCnt - 1;
                        this.AddInboundNetworkSecurityRule(retryCnt, securityGrpName, networkClient, ruleName, rulePriority, winrmHttpsPort);
                    }
                }
            });
        }
    }

    private TryAddNetworkSecurityRule(securityGrpName, ruleName, rulePriority: number, winrmHttpsPort: string) {
        console.log("here I am %s", securityGrpName);
        var networkClient = new networkManagementClient(this.credentials, this.subscriptionId);
        try {
            networkClient.securityRules.get(this.resourceGroupName, securityGrpName, ruleName, (error, result, request, response) => {
                if (error) {
                    console.log("Rule %s not found under security Group %s", ruleName, securityGrpName);
                    var maxRetries = 3;
                    this.AddInboundNetworkSecurityRule(maxRetries, securityGrpName, networkClient, ruleName, rulePriority, winrmHttpsPort);
                }
                else {
                    console.log("Got network security rule %s under security Group %s", ruleName, securityGrpName);
                }
            });
        }
        catch (exception) {
            throw "FailedToAddRuleToNetworkSecurityGroup";
        }
    }

    private AddNetworkSecurityRuleConfig(securityGroups: [Object], ruleName: string, rulePriority: number, winrmHttpsPort: string) {
        for (var i = 0; i < securityGroups.length; i++) {
            console.log("Adding Security rule for the network security group: %s", securityGroups[i]["name"]);
            var securityGrp = securityGroups[i];
            var securityGrpName = securityGrp["name"];

            try {
                console.log("Getting the network security rule config %s under security group %s", ruleName, securityGrpName);
                this.TryAddNetworkSecurityRule(securityGrpName, ruleName, rulePriority, winrmHttpsPort);
            }
            catch (exception) {
                console.log("Failed to add the network security rule with exception: %s", exception.message);
            }
        }
    }

    private AddWinRMHttpsNetworkSecurityRuleConfig() {
        console.log("Trying to add a network security group rule");

        var _ruleName: string = "VSO-Custom-WinRM-Https-Port";
        var _rulePriority: number = 3986;
        var _winrmHttpsPort: string = "5986";

        try {
            var networkClient = new networkManagementClient(this.credentials, this.subscriptionId);
            networkClient.networkSecurityGroups.list(this.resourceGroupName, (error, result, request, response) => {
                if (error) {
                    console.log("Error in getting the list of network Security Groups for the resource-group %s", this.resourceGroupName);
                    throw new Error("FetchingOfNetworkSecurityGroupFailed")
                }

                if (result.length > 0) {
                    this.AddNetworkSecurityRuleConfig(result, _ruleName, _rulePriority, _winrmHttpsPort);
                    console.log("Over 1");
                }
            });
        }
        catch (exception) {
            console.warn(tl.loc("ARG_NetworkSecurityConfigFailed", [exception.message]));
        }
    }

    private AddAzureVMCustomScriptExtension(vmId: string, vmName: string, dnsName: string, location: string) {
        var _extensionName: string = "CustomScriptExtension";

        console.log("Adding custom script extension for virtual machine %s", vmName);
        console.log("VM Location: %s", location);
        console.log("VM DNS: %s", dnsName);

        try {
            /*
            Steps:
                1. Check if CustomScriptExtension exists.
                2. If not install it
                3.Add the inbound rule to allow traffic on winrmHttpsPort
            */
            var computeClient = new computeManagementClient(this.credentials, this.subscriptionId);

            console.log("Checking if the extension %s is present on vm %s", _extensionName, vmName);

            computeClient.virtualMachineExtensions.get(this.resourceGroupName, vmName, _extensionName, (error, result, request, response) => {
                if (error) {
                    console.log("Failed to get the extension!!");
                    //Adding the extension
                    this.AddExtensionVM(vmName, computeClient, dnsName, _extensionName, location);
                }
                else if (result != null) {
                    console.log("Extension %s is present on the vm %s", _extensionName, vmName);
                    if (result["provisioningState"] != 'Succeeded') {
                        console.log("Provisioning State of extension %s on vm %s is not Succeeded", _extensionName, vmName);
                        this.RemoveExtensionFromVM(_extensionName, vmName, computeClient);
                        this.AddExtensionVM(vmName, computeClient, dnsName, _extensionName, location);
                    }
                    else {
                        //Validate the Custom Script Execution status: if ok add the rule else add the extension
                        this.ValidateCustomScriptExecutionStatus(vmName, computeClient, dnsName, _extensionName, location);
                    }
                }
                throw tl.loc("FailedToAddExtension");
            });
        }
        catch (exception) {
            //skipped writing telemetry data
            throw tl.loc("ARG_DeploymentPrereqFailed", [exception.message]);
        }
    }

    private ValidateCustomScriptExecutionStatus(vmName: string, computeClient, dnsName: string, extensionName: string, location: string) {
        console.log("Validating the winrm configuration custom script extension status");

        computeClient.virtualMachines.get(this.resourceGroupName, vmName, { expand: 'instanceView' }, (error, result, request, response) => {
            if (error) {
                console.log("Error in getting the instance view of the virtual machine %s", util.inspect(error, { depth: null }));
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
        console.log("Adding the extension %s", extensionName);
        computeClient.virtualMachineExtensions.createOrUpdate(this.resourceGroupName, vmName, extensionName, parameters, (error, result, request, response) => {
            if (error) {
                console.log("Failed to add the extension %s", util.inspect(error, { depth: null }));
                throw tl.loc("CreationOfExtensionFailed");
            }

            console.log("Addition of extension completed with response %s", util.inspect(result, { depth: null }));
            if (result["provisioningState"] != 'Succeeded') {
                this.RemoveExtensionFromVM(extensionName, vmName, computeClient);
                throw tl.loc("ARG_SetExtensionFailedForVm", [this.resourceGroupName, vmName, result]);
            }
        });
    }

    private RemoveExtensionFromVM(extensionName, vmName, computeClient) {
        console.log("Removing the extension %s from vm %s", extensionName, vmName);
        //delete the extension
        computeClient.virtualMachineExtensions.deleteMethod(this.resourceGroupName, vmName, extensionName, (error, result, request, response) => {
            if (error) {
                console.log("Failed to delete the extension %s on the vm %s, with error Message: %s", extensionName, vmName, util.inspect(error, { depth: null }));
                throw tl.loc("FailedToDeleteExtension");
            }
            else {
                console.log("Successfully removed the extension %s from the VM %s", extensionName, vmName);
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
                console.log("Error in getting the list of virtual Machines %s", error);
                throw new Error("FailedToFetchVMList");
            }

            //console.log("Virtual Machines:");
            //console.log(util.inspect(virtualMachines, {depth: null}));

            networkClient.publicIPAddresses.list(this.resourceGroupName, (error, publicIPAddresses, request, response) => {
                if (error) {
                    console.log("Error while getting list of Public Addresses %s", error);
                    throw new Error("FailedToFetchPublicAddresses");
                }


                //console.log("PublicIpAddresses:");
                //console.log(util.inspect(publicIPAddresses, {depth: null}));

                networkClient.networkInterfaces.list(this.resourceGroupName, (error, networkInterfaces, request, response) => {
                    if (error) {
                        console.log("Failed to get the list of networkInterfaces list %s", util.inspect(error, { depth: null }));
                        throw new Error("Failed to get the list of network Interfaces");
                    }

                    //console.log("Listing network Interfaces:");
                    //console.log(util.inspect(networkInterfaces, {depth: null}));
                    //get the load balancer details 
                    networkClient.loadBalancers.list(this.resourceGroupName, (error, result, request, response) => {
                        if (error) {
                            console.log("Error while getting the list of load Balancers %s", util.inspect(error, { depth: null }));
                            throw new Error("FailedToFetchLoadBalancers");
                        }

                        console.log("LoadBalancers:");
                        console.log("result: %s", util.inspect(result, { depth: null }));

                        if (result.length > 0) {
                            for (var i = 0; i < result.length; i++) {
                                var lbName = result[i]["name"];
                                var frontEndIPConfigs = result[i]["frontendIPConfigurations"];
                                var inboundRules = result[i]["inboundNatRules"];

                                console.log("FrontEnd thing: %s %s", util.inspect(frontEndIPConfigs, { depth: null }), lbName);

                                this.fqdnMap = this.GetMachinesFqdnForLB(publicIPAddresses, networkInterfaces, frontEndIPConfigs, this.fqdnMap, debugLogsFlag);

                                console.log("FQDN Map: %s", util.inspect(this.fqdnMap, { depth: null }));

                                this.winRmHttpsPortMap = this.GetFrontEndPorts("5986", this.winRmHttpsPortMap, networkInterfaces, inboundRules, debugLogsFlag);

                                console.log("FQDN Map: %s", util.inspect(this.winRmHttpsPortMap, { depth: null }));
                            }

                            this.winRmHttpsPortMap = this.GetMachineNameFromId(this.winRmHttpsPortMap, "Front End port", virtualMachines, false, debugLogsFlag);

                            console.log("WinRmHttpsPort Map 2: %s", util.inspect(this.winRmHttpsPortMap, { depth: null }));
                        }

                        this.fqdnMap = this.GetMachinesFqdnsForPublicIP(publicIPAddresses, networkInterfaces, virtualMachines, this.fqdnMap, debugLogsFlag);

                        console.log("FQDN Map 2: %s", util.inspect(this.fqdnMap, { depth: null }));

                        this.fqdnMap = this.GetMachineNameFromId(this.fqdnMap, "FQDN", virtualMachines, true, debugLogsFlag);

                        console.log("FQDN Map 3: %s", util.inspect(this.fqdnMap, { depth: null }));

                        this.virtualMachines = virtualMachines;
                    });

                });

            });

        });
    }

    private GetMachinesFqdnsForPublicIP(publicIPAddressResources: [Object], networkInterfaceResources: [Object], azureRMVMResources: [Object], fqdnMap: {}, debugLogsFlag: string): {} {
        if (!!this.resourceGroupName && this.resourceGroupName != "" && !!publicIPAddressResources && networkInterfaceResources) {
            console.log("Trying to get FQDN for the azureRM VM resources under public IP from resource group %s", this.resourceGroupName);

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

            console.log("printing the value of FQDN Map 1");
            this.printValue(fqdnMap);

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

            console.log("printing the value of FQDN Map 1");
            this.printValue(fqdnMap);


            if (debugLogsFlag == "true") {
                //fill here
            }
        }

        console.log("Got FQDN for the azureRM VM resources under public IP from resource Group %s", this.resourceGroupName);
        console.log("***********************************************************************************************************");
        return fqdnMap;
    }

    private GetMachineNameFromId(map: {}, mapParameter: string, azureRMVMResources: [Object], throwOnTotalUnavailability: boolean, debugLogsFlag: string): {} {
        if (!!map) {
            if (debugLogsFlag == "true") {
                //fill here
            }

            console.log("throwOnTotalUnavailability: %s", throwOnTotalUnavailability);

            var errorCount = 0;
            for (var i = 0; i < azureRMVMResources.length; i++) {
                var vm = azureRMVMResources[i];
                if (!!vm["id"] && vm["id"] != "") {
                    var value = map[vm["id"]];
                    var resourceName = vm["name"];
                    if (!!value && value != "") {
                        console.log("%s value for resource %s is %s", mapParameter, resourceName, value);
                        delete map[vm["id"]];
                        map[resourceName] = value;
                    }
                    else {
                        errorCount = errorCount + 1;
                        console.log("Unable to find %s for resource %s", mapParameter, resourceName);
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
        console.log("%s : %s : %s", backEndPort, networkInterfaceResources, inboundRules);
        if (!!backEndPort && backEndPort != "" && !!networkInterfaceResources && !!inboundRules) {
            console.log("Trying to get front end ports for %s", backEndPort);

            for (var i = 0; i < inboundRules.length; i++) {
                var rule = inboundRules[i];
                console.log("BackendPort: %s : %s : %s : %s", rule["backendPort"], typeof (backEndPort), backEndPort, rule["name"]);
                if (rule["backendPort"] == backEndPort && !!rule["backendIPConfiguration"] && !!rule["backendIPConfiguration"]["id"] && rule["backendIPConfiguration"]["id"] != "") {
                    portList[rule["backendIPConfiguration"]["id"]] = rule["frontendPort"];
                }
            }

            console.log("Inside frontEnd 1");
            this.printValue(portList);

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

            console.log("Inside frontEnd 2");
            this.printValue(portList);

            if (debugLogsFlag == "true") {
                //fill here
            }
        }

        console.log("Got front end ports for %s", backEndPort);
        return portList;
    }

    private GetMachinesFqdnForLB(publicIPAddress: [Object], networkInterfaceResources: [Object], frontEndIPConfigs: [Object], fqdnMap: {}, debugLogsFlag: string): {} {
        if (!!this.resourceGroupName && this.resourceGroupName != "" && !!publicIPAddress && !!networkInterfaceResources && !!frontEndIPConfigs) {
            console.log("Trying to get the FQDN for the azureVM resources under load balancer from resource group %s", this.resourceGroupName);

            for (var i = 0; i < publicIPAddress.length; i++) {
                var publicIp = publicIPAddress[i];
                if (!!publicIp["ipConfiguration"] && !!publicIp["ipConfiguration"]["id"] && publicIp["ipConfiguration"]["id"] != "") {
                    if (!!publicIp["dnsSettings"] && !!publicIp["dnsSettings"]["fqdn"] && publicIp["dnsSettings"]["fqdn"] != "") {
                        console.log("Problem: %s", publicIp["name"]);
                        fqdnMap[publicIp["id"]] = publicIp["dnsSettings"]["fqdn"];
                    }
                    else if (!!publicIp["ipAddress"] && publicIp["ipAddress"] != "") {
                        console.log("Problem 2: %s", publicIp["name"]);
                        fqdnMap[publicIp["id"]] = publicIp["ipAddress"];
                    }
                    else if (!publicIp["ipAddress"]) {
                        console.log("Problem 3: %s", publicIp["name"]);
                        fqdnMap[publicIp["id"]] = "Not Assigned";
                    }
                }
            }

            console.log("Inside lb 1");
            this.printValue(fqdnMap);

            if (debugLogsFlag === "true") {
                //fill here
            }

            console.log("rjfjrpeoit: %s", util.inspect(frontEndIPConfigs, { depth: null }));
            //Get the NAT rule for a given ip id
            for (var i = 0; i < frontEndIPConfigs.length; i++) {
                console.log("here");
                var config = frontEndIPConfigs[i];
                if (!!config["publicIPAddress"] && !!config["publicIPAddress"]["id"] && config["publicIPAddress"]["id"] != "") {
                    var fqdn = fqdnMap[config["publicIPAddress"]["id"]];
                    if (!!fqdn && fqdn != "") {
                        delete fqdnMap[config["publicIPAddress"]["id"]];
                        if (!!config["inboundNatRules"]) {
                            for (var j = 0; j < config["inboundNatRules"].length; j++) {
                                fqdnMap[config["inboundNatRules"][j]["id"]] = fqdn;
                            }
                        }
                    }
                }
            }

            console.log("Inside lb 2");
            this.printValue(fqdnMap);

            if (debugLogsFlag === "true") {
                //fill here
            }

            for (var i = 0; i < networkInterfaceResources.length; i++) {
                var nic = networkInterfaceResources[i];
                if (!!nic["ipConfigurations"]) {
                    for (var j = 0; j < nic["ipConfigurations"].length; j++) {
                        var ipc = nic["ipConfigurations"][j];
                        if (!!ipc["loadBalancerInboundNatRules"]) {
                            for (var k = 0; k < ipc["loadBalancerInboundNatRules"].length; k++) {
                                var rule = ipc["loadBalancerInboundNatRules"][k];
                                if (!!rule && !!rule["id"] && rule["id"] != "") {
                                    var fqdn = fqdnMap[rule["id"]];
                                    if (!!fqdn && fqdn != "") {
                                        delete fqdnMap[rule["id"]];
                                        if (!!nic["virtualMachine"] && !!nic["virtualMachine"]["id"] && nic["virtualMachine"]["id"] != "") {
                                            fqdnMap[nic["virtualMachine"]["id"]] = fqdn;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            console.log("Inside lb 3");
            this.printValue(fqdnMap);

            if (debugLogsFlag === "true") {
                //fill here
            }
        }

        console.log("Got FQDN for the RM azureVM resources under load balancer from resource Group %s", this.resourceGroupName);
        return fqdnMap;
    }

    printValue(map: {}) {
        console.log("************************************************************");
        console.log("%s", util.inspect(map, { depth: null }));
        console.log("************************************************************");
    }
}