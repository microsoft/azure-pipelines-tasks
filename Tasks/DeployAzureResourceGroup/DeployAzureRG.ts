/// <reference path="../../definitions/node.d.ts" /> 
/// <reference path="../../definitions/Q.d.ts" /> 
/// <reference path="../../definitions/vsts-task-lib.d.ts" /> 
 
import path = require("path");
import tl = require("vsts-task-lib/task");
import fs = require("fs");
import util = require("util");

var minimist = require("minimist");
var azure_rest = require("ms-rest-azure");
var arm = require("azure-arm-resource");

try{
    tl.setResourcePath(path.join( __dirname, "task.json"));
}catch(err){
    tl.setResult(tl.TaskResult.Failed, tl.loc("task.json not found", err));
    process.exit();
}

export class deployAzureRG {

    private connectedServiceNameSelector:string;
    private action:string;
    private actionClassic:string;
    private resourceGroupName:string;
    private cloudService:string;
    private location:string;
    private csmFile:string;
    private csmParametersFile:string;
    private overrideParameters:string;
    private enableDeploymentPrerequisitesForCreate:boolean;
    private enableDeploymentPrerequisitesForSelect:boolean;
    private outputVariable:string;
    private subscriptionId:string;
    private connectedService:string;
    private isLoggedIn:boolean = false;
    private deploymentMode:string;
    
    constructor(){
        try{ 
            this.connectedServiceNameSelector = tl.getInput("ConnectedServiceNameSelector", true);
            this.connectedService = null;
            this.action = tl.getInput("action");
            this.actionClassic = tl.getInput("actionClassic");
            this.resourceGroupName = tl.getInput("resourceGroupName");
            this.cloudService = tl.getInput("cloudService");
            this.location = tl.getInput("location");
            this.csmFile = tl.getPathInput("csmFile");
            this.csmParametersFile = tl.getPathInput("csmParametersFile");
            this.overrideParameters = tl.getInput("overrideParameters");
            this.enableDeploymentPrerequisitesForCreate = tl.getBoolInput("enableDeploymentPrerequisitesForCreate");
            this.enableDeploymentPrerequisitesForSelect = tl.getBoolInput("enableDeploymentPrerequisitesForSelect");
            this.outputVariable = tl.getInput("outputVariable");
            this.subscriptionId = tl.getEndpointDataParameter(this.connectedService, "SubscriptionId", true);    
            this.deploymentMode = tl.getInput("deploymentMode");
        }catch(error){
            tl.setResult(tl.TaskResult.Failed, tl.loc("ConstructorFailed", error));
        }
    }

    public start(){
        switch(this.action){
           case "Create Or Update Resource Group": 
                this.createTemplateDeployment();
                break;
           default: 
                //Error Handling
                tl.setResult(tl.TaskResult.Failed, tl.loc("This Action is not handled yet."));
                break;

        }
    }

    private createDeploymentName(filePath:string):string{
        var fileName = path.basename(filePath).split(".")[0].replace(" ", "");
        var ts = new Date(Date.now());
        var depName = util.format("%s-%s%s%s-%s%s%s",fileName,ts.getFullYear(), ts.getMonth(), ts.getDate(),ts.getHours(), ts.getMinutes());
        return depName;
    } 

    private getRMCredentials(){
        var credentials = null;
        this.connectedService = tl.getInput("ConnectedServiceName");
        var endpointAuth = tl.getEndpointAuthorization(this.connectedService, true);
        //service principal authentication
        var servicePrincipalId:string = endpointAuth.parameters["serviceprincipalid"];
        var servicePrincipalKey:string = endpointAuth.parameters["serviceprincipalkey"];
        var tenantId:string = endpointAuth.parameters["tenantid"];
        credentials = new azure_rest.ApplicationTokenCredentials(servicePrincipalId, tenantId, servicePrincipalKey);
        return credentials;
    }

    private updateOverrideParameters(params){
        var override = minimist(this.overrideParameters);
        for (var key in override){
            if(params[key])
                params[key] = override[key];
        }
        return params;
    }
    
    private createTemplateDeployment(){
        var credentials = this.getRMCredentials();
        var rmClient = new arm.ResourceManagementClient(credentials, this.subscriptionId); 
        var template;
        try{ 
            template= JSON.parse(fs.readFileSync(this.csmFile, 'UTF-8'));
        }catch(err){
            console.log(err);
            tl.setResult(tl.TaskResult.Failed, tl.loc("TemplateParsingFailed"));
            return;
        }
        var parameters;
        try{
            parameters = JSON.parse(fs.readFileSync(this.csmParametersFile, 'UTF-8'));
        }catch(err){
            console.log(err);
            tl.setResult(tl.TaskResult.Failed, tl.loc("ParametersFileParsingFailed"));
            return;
        }
        var properties = {}
        properties["template"] = template;
        properties["parameters"] = parameters["parameters"];
        properties["parameters"] = this.updateOverrideParameters(properties["parameters"]);
        properties["mode"] = this.deploymentMode;
        properties["debugSetting"] = {"detailLevel": "requestContent, responseContent"};
        var deployment = {"properties": properties};
        deployment["location"] = this.location;
        rmClient.deployments.createOrUpdate(this.resourceGroupName, this.createDeploymentName(this.csmFile), deployment, null, (error, result, request, response) =>{
            if (error){
                // Logs for error handling TODO
                tl.setResult(tl.TaskResult.Failed, tl.loc("REST call failed on createTemplateDeployment"));
                for(var key in error){
                    console.log(key + ": " + error[key]);
                }
                return;
            }
            for(var key in result){
                console.log(key+": "+ result[key]);
            }
            tl.setResult(tl.TaskResult.Succeeded, tl.loc("Successfully Deployed using createTemplateDeployment"));
        } );
        if (this.outputVariable){
            process.env[this.outputVariable] = this.resourceGroupName;
        }
    }    
}