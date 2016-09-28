/// <reference path="../../definitions/node.d.ts" /> 
/// <reference path="../../definitions/vsts-task-lib.d.ts" /> 
 
import path = require("path");
import tl = require("vsts-task-lib/task");
import fs = require("fs");
import util = require("util");

var minimist = require("minimist");

var networkManagementClient = require("azure-arm-network");
var resourceManagementClient = require("azure-arm-compute");

var armResource = require("azure-arm-resource");

export class ResourceGroup {

    private connectedServiceNameSelector:string;
    private action:string;
    private actionClassic:string;
    private resourceGroupName:string;
    private location:string;
    private csmFile:string;
    private csmParametersFile:string;
    private overrideParameters:string;
    private subscriptionId:string;
    private connectedService:string;
    private deploymentMode:string;
    private outputVariable:string;
    private credentials;
    
    private networkInterfaces;
    private publicAddresses;
    private virtualMachines;
    
    constructor(action, connectedService, credentials, resourceGroupName, location, csmFile, csmParametersFile, overrideParameters, subscriptionId, deploymentMode, outputVariable) {
            this.connectedService = connectedService;
            this.action = action;
            this.resourceGroupName = resourceGroupName;
            this.location = location;
            this.csmFile = csmFile;
            this.csmParametersFile = csmParametersFile;
            this.overrideParameters = overrideParameters;
            this.subscriptionId = subscriptionId;    
            this.deploymentMode = deploymentMode
            this.credentials = credentials;
            this.outputVariable = outputVariable;
            this.networkInterfaces = null;
            this.publicAddresses = null;
            this.virtualMachines = null;
            this.execute();
    }

    private execute() {
        switch(this.action) {
           case "Create Or Update Resource Group": 
                this.createTemplateDeployment();
                break;
           case "DeleteRG":
                this.deleteResourceGroup();
                break;
           case "Select Resource Group":
                this.selectResourceGroup();
                break;
           default:
               tl.setResult(tl.TaskResult.Succeeded, tl.loc("InvalidAction"));
        }
    }

    private createDeploymentName(filePath:string):string {
        var fileName = path.basename(filePath).split(".")[0].replace(" ", "");
        var ts = new Date(Date.now());
        var depName = util.format("%s-%s%s%s-%s%s",fileName,ts.getFullYear(), ts.getMonth(), ts.getDate(),ts.getHours(), ts.getMinutes());
        return depName;
    } 

    private updateOverrideParameters(params) {
        var override = minimist(this.overrideParameters);
        for (var key in override) {
            if(params[key] != undefined)
                params[key] = override[key];
        }
        return params;
    }
    
    private createTemplateDeployment() {
        var armClient = new armResource.ResourceManagementClient(this.credentials, this.subscriptionId); 
        var template;
        try { 
            template= JSON.parse(fs.readFileSync(this.csmFile, 'UTF-8'));
        }
        catch (error) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("TemplateParsingFailed", error.message));
            return;
        }
        var parameters;
        try {
            parameters = JSON.parse(fs.readFileSync(this.csmParametersFile, 'UTF-8'));
        }
        catch (error) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("ParametersFileParsingFailed", error.message));
            return;
        }
        var properties = {}
        properties["template"] = template;
        properties["parameters"] = parameters["parameters"];
        if (this.overrideParameters!=null)
            properties["parameters"] = this.updateOverrideParameters(properties["parameters"]);
        properties["mode"] = this.deploymentMode;
        properties["debugSetting"] = {"detailLevel": "requestContent, responseContent"};
        var deployment = {"properties": properties};
        deployment["location"] = this.location;
        armClient.deployments.createOrUpdate(this.resourceGroupName, this.createDeploymentName(this.csmFile), deployment, null, (error, result, request, response) =>{
            if (error) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("RGO_createTemplateDeploymentFailed", error.message));
                return;
            }
            tl.setResult(tl.TaskResult.Succeeded, tl.loc("RGO_createTemplateDeploymentSucceeded", this.resourceGroupName));
        } );
    }

    private deleteResourceGroup() {
        var armClient = new armResource.ResourceManagementClient(this.credentials, this.subscriptionId);
        console.log(tl.loc("ARG_DeletingResourceGroup", this.resourceGroupName));
        armClient.resourceGroups.deleteMethod(this.resourceGroupName,(error, result, request, response) => {
            if (error) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("RGO_CouldNotDeletedResourceGroup", this.resourceGroupName, error.message));
                return;
            }
            tl.setResult(tl.TaskResult.Succeeded, tl.loc("RGO_DeletedResourceGroup", this.resourceGroupName));
        });
    }
    
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