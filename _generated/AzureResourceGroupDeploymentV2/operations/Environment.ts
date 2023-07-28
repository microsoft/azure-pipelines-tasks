import tl = require("azure-pipelines-task-lib/task");
import deployAzureRG = require("../models/DeployAzureRG");
import azureUtil = require("./AzureUtil");

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

    public addOrUpdateProperty(type: string, property: PropertyValue) {
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
        this.Name = environmentName;
        this.Url = null;
        this.Revision = 1;
        this.Project = new Project(projectName, projectName);

        this.Resources = resources;
        this.Properties = {
            "Microsoft-Vslabs-MG-WinRMProtocol": new PropertyValue("HTTPS"),
            "Microsoft-Vslabs-MG-SkipCACheck": new PropertyValue("False")
        };

        this.IsReserved = false;
        var user = new User(userId);
        this.CreatedBy = user;
        this.ModifiedBy = user;
        this.CreatedDate = this.formatDate(new Date());
        this.ModifiedDate = "0001-01-01T00:00:00";
    }

    private pad(num): string {
        return ("0" + num).slice(-2);
    }

    private formatDate(d): string {
        return [d.getUTCFullYear(),
        this.pad(d.getUTCMonth() + 1),
        this.pad(d.getUTCDate())].join("-") + "T" +
            [this.pad(d.getUTCHours()),
            this.pad(d.getUTCMinutes()),
            this.pad(d.getUTCSeconds())].join(":") + "Z";
    }
}

export class EnvironmentHelper {
    private taskParameters: deployAzureRG.AzureRGTaskParameters;

    constructor(taskParameters: deployAzureRG.AzureRGTaskParameters) {
        this.taskParameters = taskParameters;
    }

    public async RegisterEnvironment() {
        console.log(tl.loc("RegisteringEnvironmentVariable", this.taskParameters.resourceGroupName));
        var azureUtilObject = new azureUtil.AzureUtil(this.taskParameters);
        var resourceGroupDetails = await azureUtilObject.getResourceGroupDetails();
        this.instantiateEnvironment(resourceGroupDetails);
        console.log(tl.loc("AddedToOutputVariable", this.taskParameters.outputVariable));
    }

    private instantiateEnvironment(resourceGroupDetails: azureUtil.ResourceGroupDetails): void {
        var resources = this.getResources(resourceGroupDetails);
        tl.debug("Got resources..");
        var environment = new Environment(
            resources,
            process.env["SYSTEM_COLLECTIONID"],
            process.env["SYSTEM_TEAMPROJECT"],
            this.taskParameters.outputVariable);

        tl.setVariable(this.taskParameters.outputVariable, JSON.stringify(environment));
    }

    private getResources(resourceGroupDetails: azureUtil.ResourceGroupDetails): Array<Resource> {
        var resources = new Array<Resource>();
        var id = 1;
        for (var virtualMachine of resourceGroupDetails.VirtualMachines) {
            var fqdn = virtualMachine.WinRMHttpsPublicAddress;
            var resource = new Resource(id++, fqdn);
            resource.addOrUpdateProperty("Microsoft-Vslabs-MG-Resource-FQDN", new PropertyValue(fqdn));
            resource.addOrUpdateProperty("WinRM_Https", new PropertyValue(virtualMachine.WinRMHttpsPort.toString()));
            var tags = virtualMachine.Tags
            if (tags) {
                for (var tag in tags) {
                    resource.addOrUpdateProperty(tag, new PropertyValue(tags[tag]));
                }
            }
            if (fqdn)
                resources.push(resource);
        }

        return resources;
    }
}

