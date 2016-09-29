
class Property {
    public IsSecure: string;
    public Data: string;

    constructor(data: string){
        this.Data = data;
        this.IsSecure = "false";
    }

    constructor(data: string, isSecure: string){
        this.Data = data;
        this.IsSecure = isSecure;
    }
}

class Resource {
    public Id: number;
    public Name: string;
    public Properties: { [property: string]: Property };

    constructor(id: number, name: string){
        this.Id = id;
        this.Name = name;
        
    }

}

class Project {
    public Id: string;
    public Name: string;
}

class User {
    public Name: string;
}

class Environment {
    public Id: number;
    public Url: string;
    public Revision: number;
    public Project: Project;
    public ModifiedBy: User;
    public Resources: Array<Resource>;
    public Properties: { [property: string]: Property };
    public Name: string;
    public IsReserved: boolean;
    public CreatedBy: User;
    public CreatedDate: string;
    public ModifiedDate: string;
}

export class Environment{
      private getConstantsForJSON() {
        var RG = {};
        RG["Id"] = 0;
        RG["Url"] = null;
        RG["Revision"] = 0;
        RG["Project"] = {};
        RG["Project"]["Id"] = process.env["SYSTEM_TEAMPROJECT"];
        RG["Project"]["Name"] = process.env["SYSTEM_TEAMPROJECT"];
        RG["ModifiedBy"] = { "Name": process.env["SYSTEM_COLLECTIONID"] };
        RG["CreatedBy"] = { "Name": process.env["SYSTEM_COLLECTIONID"] };
        RG["IsReserved"] = false;
        RG["Properties"] = { "Microsoft-Vslabs-MG-WinRMProtocol": { "IsSecure": false, "Data": "HTTPS" }, "Microsoft-Vslabs-MG-SkipCACheck": { "IsSecure": false, "Data": "False" } };
        RG["Name"] = this.outputVariable;
        var ts = new Date();
        var time = util.format("%s-%s-%sT%s:%s:%s.%sZ", ts.getFullYear(), ts.getMonth(), ts.getDate(), ts.getHours(), ts.getMinutes(), ts.getSeconds(), ts.getMilliseconds());
        RG["CreatedDate"] = time;
        RG["ModifiedDate"] = "0001-01-01T00:00:00"; 
        return RG;
    }

    private makeRGJSON(tags) {
        var RG = this.getConstantsForJSON();
        var resources = [];
        var i = 1;
        for (var fqdn in tags) {
            var resource = {};
            resource["Id"] = i;
            i++;
            resource["Name"] = fqdn;
            var properties = {};
            properties["Microsoft-Vslabs-MG-Resource-FQDN"] = { "Data": fqdn, "IsSecure": false };
            properties["WinRM_Https"] = { "IsSecure": false, "Data": "5986" };
            if (tags[fqdn] != null || tags[fqdn] != undefined) {
                for (var tag in tags[fqdn]) {
                    properties[tag] = { "IsSecure": false, "Data": tags[fqdn][tag] };
                }
            }
            resource["Properties"] = properties;
            resources = resources.concat(resource);
        }
        RG["Resources"] = resources;
        // Updating environment variable
        process.env[this.outputVariable] = RG;
    }

    private setOutputVariable() {
        if (this.networkInterfaces == null || this.publicAddresses == null || this.virtualMachines == null) {
            return;
        }
        // All required ones are set up.
        // NetworkID : tags
        var tags = {};

        // VMs
        // VMName -> NetworkInterfaceId
        // NetworkInterfaceId -> Public IP


        for (var i = 0; i < this.virtualMachines.length; i++) {
            var vm = this.virtualMachines[i];
            var networkId = vm["networkProfile"]["networkInterfaces"][0]["id"];
            if (vm["tags"] != undefined)
                tags[networkId] = vm["tags"];
        }
        // PublicAddressId : tags
        var interfaces = {};
        for (var i = 0; i < this.networkInterfaces.length; i++) {
            var networkInterface = this.networkInterfaces[i];
            var networkId = networkInterface["id"];
            interfaces[networkInterface["ipConfigurations"][0]["publicIPAddress"]["id"]] = tags[networkId];
        }
        // FQDN : tags
        var fqdns = {};
        for (var i = 0; i < this.publicAddresses.length; i++) {
            var publicAddress = this.publicAddresses[i];
            var publicAddressId = publicAddress["id"];
            if (publicAddress["dnsSettings"]) {
                fqdns[publicAddress["dnsSettings"]["fqdn"]] = interfaces[publicAddressId];
            }
            else {
                fqdns[publicAddress["ipAddress"]] = interfaces[publicAddressId];
            }
        }
        this.makeRGJSON(fqdns);
    }
     private selectResourceGroup() {
        if (this.outputVariable == null || this.outputVariable.trim() == "") {
            // Raise Error
            tl.setResult(tl.TaskResult.Failed, "Output variable can not be empty")
        }

        var armClient = new networkManagementClient(this.credentials, this.subscriptionId);
        armClient.networkInterfaces.list(this.resourceGroupName, (error, result, request, response) => {
            if (error){
                console.log("Error while getting list of Network Interfaces")
            }
            this.networkInterfaces = result;
            this.setOutputVariable();  
        });

        armClient.publicIPAddresses.list(this.resourceGroupName, (error, result, request, response) => {
            if (error){
                console.log("Error while getting list of Public Addresses")
            }
            this.publicAddresses = result;
            this.setOutputVariable();
        });

        armClient = new resourceManagementClient(this.credentials, this.subscriptionId);
        armClient.virtualMachines.list(this.resourceGroupName, (error, result, request, response) => {
            if (error){
                console.log("Error while getting list of Virtual Machines")
            }
            this.virtualMachines = result;
            this.setOutputVariable();            
        });
    }

}