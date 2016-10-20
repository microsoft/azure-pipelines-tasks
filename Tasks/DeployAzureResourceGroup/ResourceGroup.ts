/// <reference path="../../definitions/node.d.ts" /> 
/// <reference path="../../definitions/vsts-task-lib.d.ts" /> 
 
import path = require("path");
import tl = require("vsts-task-lib/task");
import fs = require("fs");
import util = require("util");

import env = require("./Environment");

var minimist = require("minimist");

var armResource = require("azure-arm-resource");


export class ResourceGroup {

    private connectedServiceNameSelector:string;
    private action:string;
    private actionClassic:string;
    private resourceGroupName:string;
    private location:string;
    private csmFile:string;
    private csmParametersFile:string;
    private templateLocation:string;
    private csmFileLink:string;
    private csmParametersFileLink:string;
    private overrideParameters:string;
    private subscriptionId:string;
    private connectedService:string;
    private deploymentMode:string;
    private outputVariable:string;
    private credentials;
    
    private networkInterfaces;
    private publicAddresses;
    private virtualMachines;
    
    constructor(deployRGObj) {
            this.connectedService = deployRGObj.connectedService;
            this.action = deployRGObj.action;
            this.resourceGroupName = deployRGObj.resourceGroupName;
            this.location = deployRGObj.location;
            this.csmFile = deployRGObj.csmFile;
            this.csmParametersFile = deployRGObj.csmParametersFile;
            this.overrideParameters = deployRGObj.overrideParameters;
            this.subscriptionId = deployRGObj.subscriptionId;    
            this.deploymentMode = deployRGObj.deploymentMode
            this.credentials = deployRGObj.credentials;
            this.outputVariable = deployRGObj.outputVariable;
            this.csmFileLink = deployRGObj.templateLocation;
            this.csmParametersFileLink = deployRGObj.csmParametersFileLink;
            this.templateLocation = deployRGObj.templateLocation;
            this.networkInterfaces = null;
            this.publicAddresses = null;
            this.virtualMachines = null;
            this.execute();
    }

    private execute() {
        switch(this.action) {
           case "Create Or Update Resource Group": 
                this.createOrUpdateRG();
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
        var override = minimist([this.overrideParameters]);
        for (var key in override) {
            if (params[key] != undefined)
                params[key]["value"] = override[key];
        }
        return params;
    }
    
    private createOrUpdateRG() {
        var armClient = new armResource.ResourceManagementClient(this.credentials, this.subscriptionId);
        armClient.resourceGroups.checkExistence(this.resourceGroupName, (error, exists, request, response) => {
            if (error) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("ResourceGroupStatusFetchFailed", error))
            }
            if (exists) {
                this.createTemplateDeployment(armClient);
            } else {
                this.createRGIfNotExist(armClient);
            }
        });
    }

    private createRGIfNotExist(armClient) {
        console.log(this.resourceGroupName+" resource Group Not found");
        console.log("Creating a new Resource Group:"+ this.resourceGroupName);
        armClient.resourceGroups.createOrUpdate(this.resourceGroupName, {"name": this.resourceGroupName, "location": this.location}, (error, result, request, response) => {
            if (error) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("ResourceGroupCreationFailed", error))
            } else {
                this.createTemplateDeployment(armClient);
            }
        });
    }
    
    private getDeploymentDataFromExternalLinks() {
        var properties = {}
        properties["templateLink"] = this.csmFileLink;
        properties["parametersLink"] = this.csmParametersFileLink;
        properties["mode"] = this.deploymentMode;
        properties["debugSetting"] = {"detailLevel": "requestContent, responseContent"};
        var deployment = {"properties": properties};
        deployment["location"] = this.location;
        return deployment;
    }

    private getDeploymentDataFromLinkedArtifact() {
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
        return deployment;
    }
    
    private createTemplateDeployment(armClient) {
        var deployment;
        if (this.templateLocation === "Linked Artifact") {
            deployment = this.getDeploymentDataFromLinkedArtifact();
        } else {
            deployment = this.getDeploymentDataFromExternalLinks();
        }
        armClient.deployments.createOrUpdate(this.resourceGroupName, this.createDeploymentName(this.csmFile), deployment, null, (error, result, request, response) => {
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
    
    private selectResourceGroup() {
        try {
            new env.RegisterEnvironment(this.credentials, this.subscriptionId, this.resourceGroupName, this.outputVariable);

        } catch(error) {            
            tl.setResult(tl.TaskResult.Failed, tl.loc("FailedRegisteringEnvironment", error));
            return;
        }
        tl.setResult(tl.TaskResult.Succeeded, tl.loc("selectResourceGroupSuccessfull", this.resourceGroupName, this.outputVariable))
    }
}