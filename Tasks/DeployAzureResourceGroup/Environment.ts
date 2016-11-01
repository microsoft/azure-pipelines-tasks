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
                var publicAddressId = publicAddress["id"]; //Didn't convert to lowercase
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

    private AddWinRMHttpsNetworkSecurityRuleConfig(vmName: string){
    }

    public AddAzureVMCustomScriptExtension(vmId: string, vmName: string, dnsName: string, location: string){
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
                    console.log("Skipping the addition of the extension %s on the vm %s", _extensionName, vmName);
                    if(result["provisioningState"] != 'Succeeded'){
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
            throw new Error("ARG_DeploymentPrereqFailed" + exception.message);
        }
    }

    private ValidateCustomScriptExecutionStatus(vmName: string, computeClient, dnsName: string, extensionName: string, location: string){
        console.log("Validating the winrm configuration custom script extension status");

        computeClient.virtualMachines.get(this.resourceGroupName, vmName, {expand: 'instanceView'}, (error, result, request, response)=>{
            if(error){
                console.log("Error in getting the instance view of the virtual machine %s", util.inspect(error, {depth: null}));
                throw new Error("FailedToFetchInstanceViewVM");
            }
            console.log(util.inspect(result, {depth: null}));
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
                this.RemoveExtensionFromVM(extensionName, vmName, computeClient);
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
                throw new Error("ARG_CreateOrUpdatextensionForVMFailed");
            }
            //Add the network security rule
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
}