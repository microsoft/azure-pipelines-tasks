var networkManagementClient = require("azure-arm-network");
var computeManagementClient = require("azure-arm-compute");
import util = require("util");
import tl = require("vsts-task-lib/task");

class PropertyValue {
    public IsSecure: boolean;
    public Data: string;

    constructor(data: string, isSecure?: boolean) {
        this.Data = data;
        this.IsSecure = !!isSecure;
    }
}

class Resource {
    public Id: number;
    public Name: string;
    public Properties: { [property: string]: PropertyValue };

    constructor(id: number, name: string) {
        this.Id = id;
        this.Name = name;
        this.Properties = {};
    }

    public addOrUpdateProperty(type: string, property: PropertyValue ) {
        this.Properties[type] = property;
    }
}

class Project {
    public Id: string;
    public Name: string;
    
    constructor(id: string, name: string) {
        this.Id = id;
        this.Name = name;
    }
}

class User {
    public Name: string;

    constructor(name: string) {
        this.Name = name;
    }
}

class Environment {
    public Id: number;
    public Url: string;
    public Revision: number;
    public Project: Project;
    public ModifiedBy: User;
    public Resources: Array<Resource>;
    public Properties: { [property: string]: PropertyValue };
    public Name: string;
    public IsReserved: boolean;
    public CreatedBy: User;
    public CreatedDate: string;
    public ModifiedDate: string;

    constructor(resources: Array<Resource>, userId: string, projectName: string, environmentName: string) {
        this.Id = 0;
        this.Url = "null";
        this.Revision = 1;
        this.Project = new Project(projectName, projectName);
        this.ModifiedBy = user;
        this.Resources = resources;
        this.Properties = { 
            "Microsoft-Vslabs-MG-WinRMProtocol": new PropertyValue("HTTPS"), 
            "Microsoft-Vslabs-MG-SkipCACheck": new PropertyValue("False") 
        };
        this.Name = environmentName;
        this.IsReserved = false;
        this.CreatedBy = user;
        var user = new User(userId);
        var timestamp = new Date();
        this.CreatedDate = util.format("%s-%s-%sT%s:%s:%s.%sZ", timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), 
                                        timestamp.getHours(), timestamp.getMinutes(), timestamp.getSeconds(), timestamp.getMilliseconds());
        this.ModifiedDate = "0001-01-01T00:00:00";
    }
}

export class RegisterEnvironment {
    private credentials;
    private subscriptionId: string;
    private resourceGroupName: string;
    private publicAddressToNetworkIdMap;
    private publicAddressToFqdnMap;
    private networkIdToTagsMap;
    private outputVariable: string;

    constructor(credentials, subscriptionId, resourceGroupName, outputVariable) {
        this.credentials = credentials;
        this.subscriptionId = subscriptionId;
        this.resourceGroupName = resourceGroupName;
        this.outputVariable = outputVariable;
        if (this.outputVariable == null || this.outputVariable.trim() == "") {
            tl.setResult(tl.TaskResult.Failed, "Output variable should not be empty");
            return;
        }
        this.publicAddressToNetworkIdMap = null;
        this.networkIdToTagsMap = null;
        this.publicAddressToFqdnMap = null;
        this.getVMDetails();
        this.getNetworkInterfaceDetails();
        this.getPublicIPAddresses();
    }

    private InstantiateEnvironment() {
        if (this.publicAddressToNetworkIdMap == null || this.publicAddressToFqdnMap == null || this.networkIdToTagsMap == null) {
            return;
        }
        var resources = this.getResources();
        var environment = new Environment(resources, process.env["SYSTEM_COLLECTIONID"], process.env["SYSTEM_TEAMPROJECT"], this.outputVariable);
        console.log(JSON.stringify(environment));                
        tl.setVariable(this.outputVariable, JSON.stringify(environment));
    }

    private getTags(addressId: string){
        var networkId =  this.publicAddressToNetworkIdMap[addressId];
        return this.networkIdToTagsMap[networkId];
    }

    private getResources() {
        var resources = new Array<Resource>();
        var id = 1;
        for (var addressId in this.publicAddressToFqdnMap) {
            var fqdn = this.publicAddressToFqdnMap[addressId];
            var resource = new Resource(id++ , fqdn);
            resource.addOrUpdateProperty("Microsoft-Vslabs-MG-Resource-FQDN", new PropertyValue(fqdn));
            // Default
            resource.addOrUpdateProperty("WinRM_Https", new PropertyValue("5986")); 
            var tags = this.getTags(addressId);
            if (tags) {
                for (var tag in tags) {
                    resource.addOrUpdateProperty(tag, new PropertyValue(tags[tag]));
                }
            }
            resources.push(resource);
        }
        return resources;
    }

    private getVMDetails() {
        var armClient = new computeManagementClient(this.credentials, this.subscriptionId);
        armClient.virtualMachines.list(this.resourceGroupName, (error, virtualMachines, request, response) => {
            if (error){
                console.log("Error while getting list of Virtual Machines", error);
                throw new Error("FailedToFetchVMs");
            }
            var tags = {};
            for (var i = 0; i < virtualMachines.length; i++) {
                var vm = virtualMachines[i];
                var networkId = vm["networkProfile"]["networkInterfaces"][0]["id"];
                if (vm["tags"] != undefined)
                    tags[networkId] = vm["tags"];
            }
            this.networkIdToTagsMap = tags;
            this.InstantiateEnvironment();            
        });
    }

    private getNetworkInterfaceDetails() {
        var armClient = new networkManagementClient(this.credentials, this.subscriptionId);
        armClient.networkInterfaces.list(this.resourceGroupName, (error, networkInterfaces, request, response) => {
            if (error){
                console.log("Error while getting list of Network Interfaces", error);
                throw new Error("FailedToFetchNetworkInterfaces");
            }
            var interfaces = {};
            for (var i = 0; i < networkInterfaces.length; i++) {
                var networkInterface = networkInterfaces[i];
                var networkId = networkInterface["id"];
                interfaces[networkInterface["ipConfigurations"][0]["publicIPAddress"]["id"]] = networkId;
            }
            this.publicAddressToNetworkIdMap = interfaces;
            this.InstantiateEnvironment();  
        });
    }

    private getPublicIPAddresses() {
        var armClient = new networkManagementClient(this.credentials, this.subscriptionId);
        armClient.publicIPAddresses.list(this.resourceGroupName, (error, publicAddresses, request, response) => {
            if (error){
                console.log("Error while getting list of Public Addresses", error);
                throw new Error("FailedToFetchPublicAddresses");
            }
            var fqdns = {}
            for (var i = 0; i < publicAddresses.length; i++) {
                var publicAddress = publicAddresses[i];
                var publicAddressId = publicAddress["id"];
                if (publicAddress["dnsSettings"]) {
                    fqdns[publicAddressId] = publicAddress["dnsSettings"]["fqdn"];
                }
                else {
                    fqdns[publicAddressId] = publicAddress["ipAddress"];
                }
            }
            this.publicAddressToFqdnMap = fqdns;
            this.InstantiateEnvironment();
        });
    }
    
}

export class WinRMExtension{
    private resourceGroupName: string;
    private credentials;
    private subscriptionId: string;
    private enablePrereq: boolean;

    constructor(resourceGroupName: string, credentials, subscriptionId: string, enablePrereq: boolean){
        this.resourceGroupName = resourceGroupName;
        this.credentials = credentials;
        this.subscriptionId = subscriptionId;
        this.enablePrereq = enablePrereq;
        this.GetAzureRMVMsConnectionDetailsInResourceGroup(this.enablePrereq);
    }

    
    private AddInboundNetworkSecurityRule(retryCnt: number, securityGrpName, networkClient, ruleName, rulePriority, winrmHttpsPort){
           try{
               console.log("Adding inbound network security rule config %s with priority %s for port %s under security group %s", ruleName, rulePriority, winrmHttpsPort, securityGrpName);
               var securityRuleParameters = {direction: "Inbound", access: "Allow", sourceAddressPrefix: "*", sourcePortRange: "*", destinationAddressPrefix: "*", destinationPortRange: winrmHttpsPort, protocol: "*", priority: rulePriority};
                           
               networkClient.securityRules.createOrUpdate(this.resourceGroupName, securityGrpName, ruleName, securityRuleParameters, (error, result, request, response)=>{
                   if(error){
                       console.log("Error in adding network security rule %s", util.inspect(error, {depth: null}));
                       throw "FailedToAddRuleToNetworkSecurityGroup";
                    }    
                    console.log("Added inbound network security rule config %s with priority %s for port %s under security group %s with result: %s", ruleName, rulePriority, winrmHttpsPort, securityGrpName, util.inspect(result, {depth: null}));              
                });
           }
            catch(exception){
                console.log("Failed to add inbound network security rule config %s with priority %s for port %s under security group %s: %s", ruleName, rulePriority, winrmHttpsPort, securityGrpName, exception.message);
                rulePriority = rulePriority + 50;
                console.log("Getting network security group %s in resource group %s", securityGrpName, this.resourceGroupName);

                networkClient.networkSecurityGroups.list(this.resourceGroupName, (error, result, request, response)=>{
                    if(error){
                        console.log("Error in getting the list of network Security Groups for the resource-group %s", this.resourceGroupName);
                        throw "FetchingOfNetworkSecurityGroupFailed";
                    }

                    if(result.length > 0){
                        console.log("Got network security group %s in resource group %s", securityGrpName, this.resourceGroupName);
                        if(retryCnt>0){
                            this.AddInboundNetworkSecurityRule(retryCnt - 1, securityGrpName, networkClient, ruleName, rulePriority, winrmHttpsPort);
                        }
                    }
                });
            }
        }

    private AddNetworkSecurityRuleConfig(securityGroups: [Object], ruleName: string, rulePriority: number, winrmHttpsPort: string){
        for(var i =0; i < securityGroups.length; i++){
            console.log("Adding Security rule for the network security group: %s", util.inspect(securityGroups[i], {depth: null}));
            var securityGrp = securityGroups[i];
            var securityGrpName = securityGrp["name"];
            try{
                console.log("Getting the network security rule config %s under security group %s", ruleName, securityGrpName);

                var networkClient = new networkManagementClient(this.credentials, this.subscriptionId);
                networkClient.securityRules.get(this.resourceGroupName, securityGrpName, ruleName, (error, result, request, response)=>{
                    if(error){
                        console.log("Rule %s not found under security Group %s",ruleName, securityGrpName);
                        var maxRetries = 3;
                        this.AddInboundNetworkSecurityRule(maxRetries, securityGrpName, networkClient, ruleName, rulePriority, winrmHttpsPort);
                    }
                    else{
                        console.log("Got network security rule %s under security Group %s", ruleName, securityGrpName);
                    }
                });
            }
            catch(exception){
                console.log("Failed to add the network security rule with exception: %s", exception.message);
            }
        }
    }

    private AddWinRMHttpsNetworkSecurityRuleConfig(vmName: string){
        console.log("Trying to add a network security group rule");

        var _ruleName: string = "VSO-Custom-WinRM-Https-Port";
        var _rulePriority: number =3986;
        var _winrmHttpsPort: string = "5986";
        
        try{
            var networkClient = new networkManagementClient(this.credentials, this.subscriptionId);
            networkClient.networkSecurityGroups.list(this.resourceGroupName, (error, result, request, response)=>{
                if(error){
                    console.log("Error in getting the list of network Security Groups for the resource-group %s", this.resourceGroupName);
                    throw new Error("FetchingOfNetworkSecurityGroupFailed")
                }

                if(result.length > 0){
                    this.AddNetworkSecurityRuleConfig(result, _ruleName, _rulePriority, _winrmHttpsPort);
                }
            });
        }
        catch(exception){
            console.warn(tl.loc("ARG_NetworkSecurityConfigFailed", [exception.message]));
        }
    }

    private AddAzureVMCustomScriptExtension(vmId: string, vmName: string, dnsName: string, location: string){
        var _extensionName: string ="CustomScriptExtension"; 

        console.log("Adding custom script extension for virtual machine %s",vmName);
        console.log("VM Location: %s", location);
        console.log("VM DNS: %s", dnsName);

        try{
            /*
            Steps:
                1. Check if CustomScriptExtension exists.
                2. If not install it
                3.Add the inbound rule to allow traffic on winrmHttpsPort
            */
            var computeClient = new computeManagementClient(this.credentials, this.subscriptionId);

            console.log("Checking if the extension %s is present on vm %s", _extensionName, vmName);
            
            computeClient.virtualMachineExtensions.get(this.resourceGroupName, vmName, _extensionName, (error, result, request , response)=>{
                if(error){
                    console.log("Failed to get the extension!!");
                    //Adding the extension
                    this.AddExtensionVM(vmName, computeClient, dnsName, _extensionName, location);
                }
                else if(result!=null){
                    console.log("Extension %s is present on the vm %s", _extensionName, vmName);
                    if(result["provisioningState"] != 'Succeeded'){
                        console.log("Provisioning State of extension %s on vm %s is not Succeeded", _extensionName, vmName);
                        this.RemoveExtensionFromVM(_extensionName, vmName, computeClient);
                        this.AddExtensionVM(vmName, computeClient, dnsName, _extensionName, location);
                    }
                    else{
                        //Validate the Custom Script Execution status: if ok add the rule else add the extension
                        this.ValidateCustomScriptExecutionStatus(vmName, computeClient, dnsName, _extensionName, location);
                    }
                }
            });
        }
        catch(exception){
            //skipped writing telemetry data
            throw tl.loc("ARG_DeploymentPrereqFailed", [exception.message]);
        } 
    }

    private ValidateCustomScriptExecutionStatus(vmName: string, computeClient, dnsName: string, extensionName: string, location: string){
        console.log("Validating the winrm configuration custom script extension status");

        computeClient.virtualMachines.get(this.resourceGroupName, vmName, {expand: 'instanceView'}, (error, result, request, response)=>{
            if(error){
                console.log("Error in getting the instance view of the virtual machine %s", util.inspect(error, {depth: null}));
                throw new Error("FailedToFetchInstanceViewVM");
            }

            var invalidExecutionStatus: boolean = false;
            var extensions = result["instanceView"]["extensions"];
            for(var i =0; i < extensions.length; i++){
                var extension = extensions[i];
                if(extension["name"] === extensionName){
                    for(var j =0; j < extension["substatuses"]; j++){
                        var substatus = extension["substatuses"][j];
                        if(substatus["code"].include("ComponentStatus/StdErr") && !!substatus["message"] && substatus["message"] != ""){
                            invalidExecutionStatus = true;
                            break;
                        }
                    }
                }
            }
            if(invalidExecutionStatus){
                this.AddExtensionVM(vmName, computeClient, dnsName, extensionName, location);
            }
            else{
                this.AddWinRMHttpsNetworkSecurityRuleConfig(vmName);
            }
        });
    }

    private AddExtensionVM(vmName: string, computeClient, dnsName: string, extensionName: string, location: string){
        var _configWinRMScriptFile: string ="https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/201-vm-winrm-windows/ConfigureWinRM.ps1";
        var _makeCertFile: string ="https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/201-vm-winrm-windows/makecert.exe";
        var _winrmConfFile: string ="https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/201-vm-winrm-windows/winrmconf.cmd";
        var _commandToExecute: string ="powershell.exe -File ConfigureWinRM.ps1 "+dnsName;
        var _extensionType: string = 'Microsoft.Compute/virtualMachines/extensions';
        var _virtualMachineExtensionType: string = 'CustomScriptExtension';
        var _typeHandlerVersion: string = '1.7';
        var _publisher: string = 'Microsoft.Compute';

        var _protectedSettings = {commandToExecute: _commandToExecute};
        var parameters = { type: _extensionType, virtualMachineExtensionType: _virtualMachineExtensionType, typeHandlerVersion: _typeHandlerVersion, publisher: _publisher ,location: location, settings: {fileUris: [_configWinRMScriptFile, _makeCertFile, _winrmConfFile]}, protectedSettings: _protectedSettings};
        console.log("Adding the extension %s", extensionName);
        computeClient.virtualMachineExtensions.createOrUpdate(this.resourceGroupName, vmName, extensionName, parameters, (error, result, request, response) =>{
            if(error){
                console.log("Failed to add the extension %s", util.inspect(error, { depth: null}));
                throw new Error("Failed To add the extension");
            }

            console.log("Addition of extension completed with response %s", util.inspect(result, {depth: null}));
            if(result["provisioningState"] != 'Succeeded'){
                this.RemoveExtensionFromVM(extensionName, vmName, computeClient);
                throw tl.loc("ARG_SetExtensionFailedForVm", [this.resourceGroupName, vmName, result]);
            }

            this.AddWinRMHttpsNetworkSecurityRuleConfig(vmName);
        });
    }

    private RemoveExtensionFromVM(extensionName, vmName, computeClient){
        console.log("Removing the extension %s from vm %s", extensionName, vmName);
        //delete the extension
        computeClient.virtualMachineExtensions.deleteMethod(this.resourceGroupName, vmName, extensionName, (error, result, request, response)=>{
            if(error){
                console.log("Failed to delete the extension %s on the vm %s, with error Message: %s", extensionName, vmName, util.inspect(error, {depth: null}));
            }
            else{
                console.log("Successfully removed the extension %s from the VM %s", extensionName, vmName);
            }
        });
    }

    private GetAzureRMVMsConnectionDetailsInResourceGroup(enablePrereqs: boolean){
        var fqdnMap = {};
        var winRmHttpsPortMap = {};
        var vmResourceDetails = {};

        var debugLogsFlag = process.env["SYSTEM_DEBUG"];
        
        var networkClient = new networkManagementClient(this.credentials, this.subscriptionId);
        var computeClient = new computeManagementClient(this.credentials, this.subscriptionId);

        computeClient.virtualMachines.list(this.resourceGroupName, (error, virtualMachines, request, response) => {
            if(error){
                console.log("Error in getting the list of virtual Machines %s", error);
                throw new Error("FailedToFetchVMList");
            }
            networkClient.publicIPAddresses.list(this.resourceGroupName, (error, publicIPAddresses, request, response) => {
                if (error){
                    console.log("Error while getting list of Public Addresses %s", error);
                    throw new Error("FailedToFetchPublicAddresses");
                }
                networkClient.networkInterfaces.list(this.resourceGroupName, (error, networkInterfaces, request, response) => {
                    if(error){
                        console.log("Failed to get the list of networkInterfaces list %s", util.inspect(error, {depth: null}));
                        throw new Error("Failed to get the list of network Interfaces");
                    }

                    //get the load balancer details 
                    networkClient.loadBalancers.list(this.resourceGroupName, (error, result, request, response)=>{
                        if(error){
                            console.log("Error while getting the list of load Balancers %s", util.inspect(error, {depth: null}));
                            throw new Error("FailedToFetchLoadBalancers");
                        }

                        //console.log("result: %s", util.inspect(result, {depth: null}));
                        if(result.length > 0){
                            for(var i = 0; i < result.length; i++){
                                var lbName = result[i]["name"];
                                var frontEndIPConfigs = result[i]["frontendIPConfigurations"];
                                var inboundRules = result[i]["inboundNATRules"];
                                
                                fqdnMap = this.GetMachinesFqdnForLB(publicIPAddresses, networkInterfaces, frontEndIPConfigs, fqdnMap, debugLogsFlag);

                                winRmHttpsPortMap = this.GetFrontEndPorts("5986", winRmHttpsPortMap, networkInterfaces, inboundRules, debugLogsFlag);
                            }

                            winRmHttpsPortMap = this.GetMachineNameFromId(winRmHttpsPortMap, "Front End port", virtualMachines, false, debugLogsFlag);
                        }
                        
                        fqdnMap = this.GetMachinesFqdnsForPublicIP(publicIPAddresses, networkInterfaces, virtualMachines, fqdnMap, debugLogsFlag);

                        fqdnMap = this.GetMachineNameFromId(fqdnMap, "FQDN", virtualMachines, true, debugLogsFlag);

                        for(var i =0; i < virtualMachines.length; i++){
                            var vm = virtualMachines[i];
                            var resourceName = vm["name"];
                            var resourceId = vm["id"];
                            var resourceFQDN = fqdnMap[resourceName];
                            var resourceWinRmHttpsPort = winRmHttpsPortMap[resourceName];

                            if(resourceWinRmHttpsPort || resourceWinRmHttpsPort === ""){
                                console.log("Defaulting WinRmHttpsPort of %s to 5986", resourceName);
                                resourceWinRmHttpsPort = "5986";
                            }

                            if(enablePrereqs === true){
                                console.log("Enabling winrm for virtual machine %s", resourceName);
                                this.AddAzureVMCustomScriptExtension(resourceId, resourceName, resourceFQDN, vm["location"]);
                            }
                        }

                    });
                    
                });

            });

        });
    }

    private GetMachinesFqdnsForPublicIP(publicIPAddressResources: [Object], networkInterfaceResources: [Object], azureRMVMResources: [Object], fqdnMap: {}, debugLogsFlag: string): {} {
        if(!!this.resourceGroupName && this.resourceGroupName != "" && !!publicIPAddressResources && networkInterfaceResources){
            console.log("Trying to get FQDN for the azureRM VM resources under public IP from resource group %s", this.resourceGroupName);

            //Map the ipc to fqdn
            for(var i =0; i < publicIPAddressResources.length; i++){
                var publicIp = publicIPAddressResources[i];
                if(!!publicIp["ipConfiguration"] && !!publicIp["ipConfiguration"]["id"] && publicIp["ipConfiguration"]["id"] != ""){
                    if(!!publicIp["dnsSettings"] && !!publicIp["dnsSettings"]["fqdn"] && publicIp["dnsSettings"]["fqdn"] != ""){
                        fqdnMap[publicIp["ipConfiguration"]["id"]] = publicIp["dnsSettings"]["fqdn"];
                    }
                    else if(!!publicIp["ipAddress"] && publicIp["ipAddress"] != ""){
                        fqdnMap[publicIp["ipConfiguration"]["id"]] = publicIp["ipAddress"];
                    }
                    else if(!publicIp["ipAddress"]){
                        fqdnMap[publicIp["ipConfiguration"]["id"]] = "Not Assigned";
                    }
                }
            }

            if(debugLogsFlag === "true"){
                //fill here
            }

            //Find out the NIC and thus the VM corresponding to a given ipc
            for(var i =0; i < networkInterfaceResources.length; i++){
                var nic = networkInterfaceResources[i];
                if(!!nic["ipConfigurations"]){
                    for(var j=0; j < nic["ipConfigurations"].length; j++){
                        var ipc = nic["ipConfigurations"][j];
                        if(!!ipc["id"] && ipc["id"] != ""){
                            var fqdn = fqdnMap[ipc["id"]];
                            if(!!fqdn && fqdn != ""){
                                delete fqdnMap[ipc["id"]];
                                if(!!nic["virtualMachine"] && !!nic["virtualMachine"]["id"] && nic["virtualMachine"]["id"] != ""){
                                    fqdnMap[nic["virtualMachine"]["id"]] = fqdn;
                                }
                            }
                        }
                    }
                }
            }

            if(debugLogsFlag == "true"){
                //fill here
            }
        }

        console.log("Got FQDN for the azureRM VM resources under public IP from resource Group %s", this.resourceGroupName);
        return fqdnMap;
    }

    private GetMachineNameFromId(map: {}, mapParameter: string, azureRMVMResources: [Object], throwOnTotalUnavailability: boolean, debugLogsFlag: string): {} {
        if(!!map){
            if(debugLogsFlag == "true"){
                //fill here
            }

            console.log("throwOnTotalUnavailability: %s", throwOnTotalUnavailability);

            var errorCount = 0;
            for(var i =0; i < azureRMVMResources.length; i++){
                var vm = azureRMVMResources[i];
                if(!!vm["id"] && vm["id"] != ""){
                    var value = map[vm["id"]];
                    var resourceName = vm["name"];
                    if(!!value && value != ""){
                        console.log("%s value for resource %s is %s", mapParameter, resourceName, value);
                        delete map[vm["id"]];
                        map[resourceName] = value;
                    }
                    else{
                        errorCount = errorCount + 1;
                        console.log("Unable to find %s for resource %s", mapParameter, resourceName);
                    }
                }
            }

            if(throwOnTotalUnavailability === true){
                if(errorCount == azureRMVMResources.length && azureRMVMResources.length != 0){
                    throw tl.loc("ARG_AllResourceNotFound", [mapParameter, this.resourceGroupName]);
                }
                else{
                    if(errorCount > 0 && errorCount != azureRMVMResources.length){
                        console.warn(tl.loc("ARG_ResourceNotFound", [mapParameter, errorCount, this.resourceGroupName]));
                    }
                }
            }
        }

        return map;
    }

    private GetFrontEndPorts(backEndPort: string, portList: {}, networkInterfaceResources: [Object], inboundRules: [Object], debugLogsFlag: string): {} {
        if(!!backEndPort && backEndPort != "" && !!networkInterfaceResources && !!inboundRules){
            console.log("Trying to get front end ports for %s", backEndPort);
            
            for(var i =0; i < inboundRules.length; i++){
                var rule = inboundRules[i];
                if(rule["backendPort"] == backEndPort && !!rule["backendIPConfiguration"] && !!rule["backendIPConfiguration"]["id"] && rule["backendIPConfiguration"]["id"] != ""){
                    portList[rule["backendIPConfiguration"]["id"]] = rule["frontendPort"];
                }
            }

            if(debugLogsFlag === "true"){
                //fill here
            }

            //get the nic and the corrresponding machine id for a given back end ipc
            for(var i = 0; i < networkInterfaceResources.length; i++){
                var nic = networkInterfaceResources[i];
                if(!!nic["ipConfigurations"]){
                    for(var j =0; j < nic["ipConfigurations"].length; j++){
                        var ipc = nic["ipConfigurations"][j];
                        if(!!ipc && !!ipc["id"] && ipc["id"] != ""){
                            var frontendPort = portList[ipc["id"]];
                            if(!!frontendPort && frontendPort != ""){
                                delete portList[ipc["id"]];
                                if(!!nic["virtualMachine"] && !!nic["virtualMachine"]["id"] && nic["virtualMachine"]["id"] != ""){
                                    portList[nic["virtualMachine"]["id"]] = frontendPort;
                                }
                            }
                        }
                    }
                }
            }

            if(debugLogsFlag == "true"){
                //fill here
            }
        }

        console.log("Got front end ports for %s", backEndPort);
        return portList;
    }

    private GetMachinesFqdnForLB(publicIPAddress: [Object], networkInterfaceResources: [Object], frontEndIPConfigs: [Object], fqdnMap: {}, debugLogsFlag: string) : {} {
        if(!!this.resourceGroupName && this.resourceGroupName != "" && !!publicIPAddress && !!networkInterfaceResources && !!frontEndIPConfigs){
            console.log("Trying to get the FQDN for the azureVM resources under load balancer from resource group %s", this.resourceGroupName);

            for(var i =0; i < publicIPAddress.length; i++) {
                var publicIp = publicIPAddress[i];
                if(!!publicIp["ipConfiguration"] && !!publicIp["ipConfiguration"]["id"] && publicIp["ipConfiguration"]["id"] != "") {
                    if(!!publicIp["dnsSettings"] && !!publicIp["dnsSettings"]["fqdn"] && publicIp["dnsSettings"]["fqdn"] != "") {
                        fqdnMap[publicIp["id"]] = publicIp["dnsSettings"]["fqdn"];
                    }
                    else if(!!publicIp["ipAddress"] && publicIp["ipAddress"] != "") {
                        fqdnMap[publicIp["id"]] = publicIp["ipAddress"];
                    }
                    else if(!publicIp["ipAddress"]) {
                        fqdnMap[publicIp["id"]] = "Not Assigned";
                    }
                }
            }
            
            if(debugLogsFlag === "true") {
                //fill here
            }

            //Get the NAT rule for a given ip id
            for(var i =0; i < frontEndIPConfigs.length; i++) {
                var config = frontEndIPConfigs[i];
                if(!!config["publicIPAddress"] && !!config["publicIPAddress"]["id"] && config["publicIPAddress"]["id"] != "") {
                    var fqdn = fqdnMap[config["publicIPAddress"]["id"]];
                    if(!!fqdn && fqdn != "") {
                        delete fqdnMap[config["publicIPAddress"]["id"]];
                        for(var j =0; j < config["inboundNatRules"].length; j++) {
                            fqdnMap[config["inboundNatRules"][j]["id"]] = fqdn;
                        }
                    }
                }
            }

            if(debugLogsFlag === "true") {
                //fill here
            }

            for(var i = 0 ; i < networkInterfaceResources.length; i++) {
                var nic = networkInterfaceResources[i];
                if(!!nic["ipConfigurations"]){
                    for(var j = 0; j < nic["ipConfigurations"].length; j++) {
                        var ipc = nic["ipConfigurations"][j];
                        if(!!ipc["loadBalancerInboundNatRules"]){
                            for(var k =0; k < ipc["loadBalancerInboundNatRules"].length; k++) {
                                var rule = ipc["loadBalancerInboundNatRules"][k];
                                if(!!rule && !!rule["id"] && rule["id"] != "") {
                                    var fqdn = fqdnMap[rule["id"]];
                                    if(!!fqdn && fqdn!= "") {
                                        delete fqdnMap[rule["id"]];
                                        if(!!nic["virtualMachine"] && !!nic["virtualMachine"]["id"] && nic["virtualMachine"]["id"] != "") {
                                            fqdnMap[nic["virtualMachine"]["id"]] = fqdn;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if(debugLogsFlag === "true"){
                //fill here
            }
        }

        console.log("Got FQDN for the RM azureVM resources under load balancer from resource Group %s", this.resourceGroupName);
        return fqdnMap;
    }
}