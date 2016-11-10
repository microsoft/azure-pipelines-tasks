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

