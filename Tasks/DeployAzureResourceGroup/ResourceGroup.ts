/// <reference path="../../definitions/node.d.ts" /> 
/// <reference path="../../definitions/vsts-task-lib.d.ts" /> 
 /// <reference path="../../definitions/Q.d.ts" />
import path = require("path");
import tl = require("vsts-task-lib/task");
import fs = require("fs");
import util = require("util");
import q = require("q");

import env = require("./Environment");
import deployAzureRG = require("./DeployAzureRG");
import winRM = require("./WinRMHttpsListener");

var parameterParse = require("./parameterParse").parse;
var armResource = require("azure-arm-resource");
var request = require("sync-request");

class Deployment {
    public properties: Object;
    public location: string;

    constructor(properties: Object, location: string) {
        this.properties = properties;
        this.location = location;
    }
}

export class ResourceGroup {

    private taskParameters: deployAzureRG.AzureRGTaskParameters;
    private WinRMHttpsListener: winRM.WinRMHttpsListener;
    private envController: env.RegisterEnvironment;

    constructor(taskParameters: deployAzureRG.AzureRGTaskParameters) {
        this.taskParameters = taskParameters;
        this.WinRMHttpsListener = new winRM.WinRMHttpsListener(this.taskParameters.resourceGroupName, this.taskParameters.credentials, this.taskParameters.subscriptionId);
        this.envController = new env.RegisterEnvironment(this.taskParameters);
    }

    private createDeploymentName(filePath: string): string {
        var name;
        name = path.basename(filePath).split(".")[0].replace(" ", "");
        var ts = new Date(Date.now());
        var depName = util.format("%s-%s%s%s-%s%s", name, ts.getFullYear(), ts.getMonth(), ts.getDate(),ts.getHours(), ts.getMinutes());
        return depName;
    } 

    private updateOverrideParameters(params) {
        var override = parameterParse(this.taskParameters.overrideParameters);
        for (var key in override) {
            params[key] = override[key];
        }
        return params;
    }
    
    public createOrUpdateRG() {
        var armClient = new armResource.ResourceManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        armClient.resourceGroups.checkExistence(this.taskParameters.resourceGroupName, (error, exists, request, response) => {
            if (error) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("ResourceGroupStatusFetchFailed", error));
                process.exit();
            }
            if (exists) {
                this.createTemplateDeployment(armClient);
            } else {
                this.createRG(armClient).then((Succeeded) => {
                    this.createTemplateDeployment(armClient);
                });
            }
        });
    }

    private createRG(armClient): q.Promise<any> {
        var deferred = q.defer<any>();
        console.log(this.taskParameters.resourceGroupName+" resource Group Not found");
        console.log("Creating a new Resource Group:"+ this.taskParameters.resourceGroupName);
        armClient.resourceGroups.createOrUpdate(this.taskParameters.resourceGroupName, {"name": this.taskParameters.resourceGroupName, "location": this.taskParameters.location}, (error, result, request, response) => {
            if (error) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("ResourceGroupCreationFailed", error));
                process.exit();
            } 
            deferred.resolve("Succeeded");
        });
        return deferred.promise;
    }
    
    private getDeploymentDataForExternalLinks() {
        var properties = {}
        properties["templateLink"] = {"uri" : this.taskParameters.csmFileLink};
        if (this.taskParameters.csmParametersFileLink && this.taskParameters.csmParametersFileLink.trim()!="" && this.taskParameters.overrideParameters.trim()=="")
            properties["parametersLink"] = {"uri" : this.taskParameters.csmParametersFileLink };
        else {
            var params = {};
            if (this.taskParameters.csmParametersFileLink && this.taskParameters.csmParametersFileLink.trim()) {
                var response = request("GET", this.taskParameters.csmParametersFileLink);
                try { 
                    params = JSON.parse(response.body).parameters;
                } catch(error) {
                    tl.setResult(tl.TaskResult.Failed, "Make sure the end point is a JSON");
                    process.exit();
                }
            }
            params = this.updateOverrideParameters(params);
            properties["parameters"] = params;
        }
        properties["mode"] = this.taskParameters.deploymentMode;
        properties["debugSetting"] = {"detailLevel": "requestContent, responseContent"};
        return new Deployment(properties, this.taskParameters.location);
    }

    private getDeploymentDataForLinkedArtifact() {
        var template;
        try { 
            template = JSON.parse(fs.readFileSync(this.taskParameters.csmFile, 'UTF-8'));
        }
        catch (error) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("TemplateParsingFailed", error.message));
            process.exit();
        }
        var parameters;
        try {
            if (this.taskParameters.csmParametersFile && this.taskParameters.csmParametersFile.trim()) {
                var parameterFile = JSON.parse(fs.readFileSync(this.taskParameters.csmParametersFile, 'UTF-8'));
                parameters = parameterFile.parameters;
            }
            if (this.taskParameters.overrideParameters)
                parameters = this.updateOverrideParameters(parameters);
        }
        catch (error) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("ParametersFileParsingFailed", error.message));
            process.exit();
        }
        var properties = {}
        properties["template"] = template;
        properties["parameters"] = parameters;
        properties["mode"] = this.taskParameters.deploymentMode;
        properties["debugSetting"] = {"detailLevel": "requestContent, responseContent"};
        return new Deployment(properties, this.taskParameters.location);
    }

    private createTemplateDeployment(armClient) {
        var deployment;
        if (this.taskParameters.templateLocation === "Linked Artifact") {
            deployment = this.getDeploymentDataForLinkedArtifact();
        }  else {
            deployment = this.getDeploymentDataForExternalLinks();
        }
        armClient.deployments.createOrUpdate(this.taskParameters.resourceGroupName, this.createDeploymentName(this.taskParameters.csmFile), deployment, null, (error, result, request, response) => {
            if (error) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("RGO_createTemplateDeploymentFailed", error.message));
                process.exit();
            }
            if (this.taskParameters.enableDeploymentPrerequisites) {
                this.WinRMHttpsListener.EnableWinRMHttpsListener();
            }

            try {
                if (this.taskParameters.outputVariable && this.taskParameters.outputVariable.trim() != ""){
                    this.envController.RegisterEnvironment();
                }
            } catch(error) {            
                tl.setResult(tl.TaskResult.Failed, tl.loc("FailedRegisteringEnvironment", error));
                process.exit();
            }
            tl.setResult(tl.TaskResult.Succeeded, tl.loc("RGO_createTemplateDeploymentSucceeded", this.taskParameters.resourceGroupName));
        });
    }

    public deleteResourceGroup() {
        var armClient = new armResource.ResourceManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        console.log(tl.loc("ARG_DeletingResourceGroup", this.taskParameters.resourceGroupName));
        armClient.resourceGroups.deleteMethod(this.taskParameters.resourceGroupName,(error, result, request, response) => {
            if (error) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("RGO_CouldNotDeletedResourceGroup", this.taskParameters.resourceGroupName, error.message));
                process.exit();
            }
            tl.setResult(tl.TaskResult.Succeeded, tl.loc("RGO_DeletedResourceGroup", this.taskParameters.resourceGroupName));
        });
    }
    
    public selectResourceGroup() {
        if (this.taskParameters.enableDeploymentPrerequisites) {
            this.WinRMHttpsListener.EnableWinRMHttpsListener();
        }
        try {
            this.envController.RegisterEnvironment();
        } catch(error) {            
            tl.setResult(tl.TaskResult.Failed, tl.loc("FailedRegisteringEnvironment", error));
            process.exit();
        }
        tl.setResult(tl.TaskResult.Succeeded, tl.loc("selectResourceGroupSuccessfull", this.taskParameters.resourceGroupName, this.taskParameters.outputVariable))
    }
}