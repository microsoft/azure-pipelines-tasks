/// <reference path="../../definitions/node.d.ts" /> 
/// <reference path="../../definitions/vsts-task-lib.d.ts" /> 
/// <reference path="../../definitions/Q.d.ts" />
/// <reference path="../../definitions/vso-node-api.d.ts" /> 

import path = require("path");
import tl = require("vsts-task-lib/task");
import fs = require("fs");
import util = require("util");
import q = require("q");
import httpClient = require('vso-node-api/HttpClient');
var httpObj = new httpClient.HttpClient("VSTS_AGENT");

import env = require("./Environment");
import deployAzureRG = require("./DeployAzureRG");
import winRM = require("./WinRMHttpsListener");

var parameterParse = require("./parameterParse").parse;
var armResource = require("azure-arm-resource");

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
        if (!this.taskParameters.overrideParameters || !this.taskParameters.overrideParameters.trim()) {
            return params;
        }
        var override = parameterParse(this.taskParameters.overrideParameters);
        for (var key in override) {
            params[key] = override[key];
        }
        return params;
    }
    
    public  createOrUpdateRG() {
        var armClient = new armResource.ResourceManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        armClient.resourceGroups.checkExistence(this.taskParameters.resourceGroupName,  (error, exists, request, response) => {
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
        console.log(this.taskParameters.resourceGroupName+" Resource Group Not found");
        console.log("Creating a new Resource Group:"+ this.taskParameters.resourceGroupName,"..");
        armClient.resourceGroups.createOrUpdate(this.taskParameters.resourceGroupName, {"name": this.taskParameters.resourceGroupName, "location": this.taskParameters.location}, (error, result, request, response) => {
            if (error) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("ResourceGroupCreationFailed", error));
                process.exit();
            } 
            console.log("Created Resource Group!");
            deferred.resolve("Succeeded");
        });
        return deferred.promise;
    }
    
    private parseParameters(contents) {
        var params;
        try { 
            params = JSON.parse(contents).parameters;
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("ParametersFileParsingFailed", error.message));
            process.exit();
        }
        return params;
    }

    private request(url): q.Promise<string> {
        var deferred = q.defer<string>();
        httpObj.get("GET", url, null, (error, result, contents) => {
            if (error) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("URLFetchFailed", error));
                process.exit();
            }
            deferred.resolve(contents);
        })
        return deferred.promise;
    }

    private createDeployment(contents, templateLink?, template?) {
        var properties = {}
        if (templateLink) {
            properties["templateLink"] = {"uri" : templateLink};
        }
        if (template) {
            properties["template"] = template;
        }
        if (this.taskParameters.csmParametersFileLink && this.taskParameters.csmParametersFileLink.trim()!="" && this.taskParameters.overrideParameters.trim()=="")
            properties["parametersLink"] = {"uri" : this.taskParameters.csmParametersFileLink };
        else {
            var params = contents;
            properties["parameters"] = params;
            properties["mode"] = this.taskParameters.deploymentMode;
            properties["debugSetting"] = {"detailLevel": "requestContent, responseContent"};
            params = this.updateOverrideParameters(params);
        }
        return new Deployment(properties, this.taskParameters.location)
    }


    private getDeploymentDataForLinkedArtifact() {
        console.log("Getting deployment data from a linked artifact..");
        var template;
        try {
            tl.debug("Loading CSM Template File.. " + this.taskParameters.csmFile);
            template = JSON.parse(fs.readFileSync(this.taskParameters.csmFile, 'UTF-8'));
            tl.debug("Loaded CSM File");
            tl.debug("CSM File data: " + JSON.stringify(template));
        }
        catch (error) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("TemplateParsingFailed", error.message));
            process.exit();
        }
        var parameters;
        try {
            if (this.taskParameters.csmParametersFile && this.taskParameters.csmParametersFile.trim()) {
                tl.debug("Loading Parameters File.. " + this.taskParameters.csmParametersFile); 
                var parameterFile = fs.readFileSync(this.taskParameters.csmParametersFile, 'UTF-8');
                tl.debug("Loaded Parameters File");
                parameters = this.parseParameters(parameterFile);
                tl.debug("Parameters file data: " + JSON.stringify(parameters));
            }
            tl.debug("Overriding Parameters..");
            parameters = this.updateOverrideParameters(parameters);
            tl.debug("Parameters after overriding." + JSON.stringify(parameters));
        }
        catch (error) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("ParametersFileParsingFailed", error.message));
            process.exit();
        }
        return this.createDeployment(parameters, null, template);
    }

    private startDeployment(armClient, deployment) {
         console.log("Starting Deployment");
         armClient.deployments.createOrUpdate(this.taskParameters.resourceGroupName, this.createDeploymentName(this.taskParameters.csmFile), deployment, null, (error, result, request, response) => {
            if (error) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("RGO_createTemplateDeploymentFailed", error.message));
                process.exit();
            }
            console.log("Completed Deployment");
            if (this.taskParameters.enableDeploymentPrerequisites) {
                console.log("Enabling winRM Https Listener on your windows machines..");
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

    private createTemplateDeployment(armClient) {
        console.log("Creating Template Deployment")
        if (this.taskParameters.templateLocation === "Linked Artifact") {
            var deployment = this.getDeploymentDataForLinkedArtifact();
            this.startDeployment(armClient, deployment);
        } else {
            if (this.taskParameters.csmParametersFileLink && this.taskParameters.csmParametersFileLink.trim() && !this.taskParameters.overrideParameters && !this.taskParameters.overrideParameters.trim()) {
                var deployment = this.createDeployment({});
                this.startDeployment(armClient, this.taskParameters.location)
            } else {
                this.request(this.taskParameters.csmParametersFileLink).then((contents) => {
                    var parameters = JSON.parse(contents).parameters;
                    var deployment = this.createDeployment(parameters, this.taskParameters.csmFileLink);
                    this.startDeployment(armClient, this.taskParameters.location);
                });
            }
        }
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
            console.log("Enabling winRM Https Listener on your windows machines..");
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
