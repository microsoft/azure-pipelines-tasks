/// <reference path="../../definitions/node.d.ts" /> 
/// <reference path="../../definitions/Q.d.ts" /> 
/// <reference path="../../definitions/vsts-task-lib.d.ts" /> 
 
import path = require("path");
import tl = require("vsts-task-lib/task");
import fs = require("fs");
import util = require("util");

var minimist = require("minimist");
var msRestAzure = require("ms-rest-azure");
var armResource = require("azure-arm-resource");
var computeManagementClient = require('azure-arm-compute');

try{
    tl.setResourcePath(path.join( __dirname, "task.json"));
}catch(err){
    tl.setResult(tl.TaskResult.Failed, tl.loc("task.json not found", err));
    process.exit();
}

export class AzureResourceGroupDeployment {

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
            if(this.connectedServiceNameSelector === "ConnectedServiceName"){
                this.connectedService = tl.getInput("ConnectedServiceName");
            }
            else{
                this.connectedService = tl.getInput("ConnectedServiceNameClassic");
            }
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
        }
        catch(error){
            tl.setResult(tl.TaskResult.Failed, tl.loc("ConstructorFailed", error));
        }
    }

    public start(){
        switch(this.action){
           case "Create Or Update Resource Group": 
                this.createTemplateDeployment();
                break;
           case "DeleteRG":
                this.deleteResourceGroup();
                break;
           case "Start":
           case "Stop":
           case "Restart":
           case "Delete":
               new VMOperations(this.resourceGroupName, this.action, this.subscriptionId, this.connectedService, this.getARMCredentials());
               break;
           default:
               tl.setResult(tl.TaskResult.Succeeded, tl.loc("InvalidAction"));
               process.exit();
        }
    }

    private createDeploymentName(filePath:string):string{
        var fileName = path.basename(filePath).split(".")[0].replace(" ", "");
        var ts = new Date(Date.now());
        var depName = util.format("%s-%s%s%s-%s%s%s",fileName,ts.getFullYear(), ts.getMonth(), ts.getDate(),ts.getHours(), ts.getMinutes());
        return depName;
    } 

    private getARMCredentials(){
        var endpointAuth = tl.getEndpointAuthorization(this.connectedService, true);
        var servicePrincipalId:string = endpointAuth.parameters["serviceprincipalid"];
        var servicePrincipalKey:string = endpointAuth.parameters["serviceprincipalkey"];
        var tenantId:string = endpointAuth.parameters["tenantid"];
        var credentials = new msRestAzure.ApplicationTokenCredentials(servicePrincipalId, tenantId, servicePrincipalKey);
        return credentials;
    }

    private updateOverrideParameters(params){
        var override = minimist(this.overrideParameters);
        for (var key in override){
            if(params[key] != undefined)
                params[key] = override[key];
        }
        return params;
    }
    
    private createTemplateDeployment(){
        var credentials = this.getARMCredentials();
        var armClient = new armResource.ResourceManagementClient(credentials, this.subscriptionId); 
        var template;
        try{ 
            template= JSON.parse(fs.readFileSync(this.csmFile, 'UTF-8'));
        }
        catch(err){
            tl.setResult(tl.TaskResult.Failed, tl.loc("TemplateParsingFailed", err));
            return;
        }
        var parameters;
        try{
            parameters = JSON.parse(fs.readFileSync(this.csmParametersFile, 'UTF-8'));
        }
        catch(err){
            tl.setResult(tl.TaskResult.Failed, tl.loc("ParametersFileParsingFailed", err));
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
        armClient.deployments.createOrUpdate(this.resourceGroupName, this.createDeploymentName(this.csmFile), deployment, null, (error, result, request, response) =>{
            if (error){
                // Logs for error handling TODO
                tl.setResult(tl.TaskResult.Failed, tl.loc("REST call failed on createTemplateDeployment"));
                return;
            }
            tl.setResult(tl.TaskResult.Succeeded, tl.loc("ARG_CreatedResourceGroup", this.resourceGroupName));
        } );
        if (this.outputVariable){
            process.env[this.outputVariable] = this.resourceGroupName;
        }
    }

    private deleteResourceGroup(){
        var credentials = this.getARMCredentials();
        var armClient = new armResource.ResourceManagementClient(credentials, this.subscriptionId);
        console.log(tl.loc("ARG_DeletingResourceGroup", this.resourceGroupName));
        armClient.resourceGroups.deleteMethod(this.resourceGroupName,(error, result, request, response) =>{
            if (error){
                tl.setResult(tl.TaskResult.Failed, tl.loc("Deletion of RG failed :"+ this.resourceGroupName));
                return;
            }
            tl.setResult(tl.TaskResult.Succeeded, tl.loc("ARG_DeletedResourceGroup", this.resourceGroupName));
        });
    }

}

class VMOperations{
    private action:string;
    private resourceGroupName:string;
    private subscriptionId:string;
    private connectedService:string;
    private credentials;
    private operation;
    private client;
    private failureCount:number;
    private successCount:number;
    private errors:string;

    constructor(resourceGroupName, action, subscriptionID, connectedService, credentials){
        try{
            this.resourceGroupName = resourceGroupName;
            this.subscriptionId = subscriptionID;
            this.connectedService = connectedService;
            this.credentials = credentials;
            this.client = new computeManagementClient(this.credentials, this.subscriptionId);
            this.action = action;
            
        }
        catch(error){
            tl.setResult(tl.TaskResult.Failed, tl.loc("VMOperationsInitiationFailed", this.action, error));
            return;
        }
        this.successCount = 0;
        this.failureCount = 0;
        this.start();
    }

    private postOperationCallBack(error, result, request, response){
        if(error){
            this.failureCount++;
            //Update errors
        }
        else{
            this.successCount++;
        }
        this.setTaskResult();
    }

    private setTaskResult(){
        if(this.failureCount>0){
            tl.setResult(tl.TaskResult.Failed,tl.loc("FailureOnVMOperation", this.action, this.errors))
        }
        else{
            tl.setResult(tl.TaskResult.Succeeded,tl.loc("SucceededOnVMOperation", this.action))
        }
    }

    private start(){
        this.client.virtualMachines.list(this.resourceGroupName, (error, listOfVms, request, response) => {
            if (listOfVms.length == 0){
                console.log("No VMs found");
                this.setTaskResult();
                return;
            }
            switch (this.action){
                case "Start":
                    for (var i=0; i<listOfVms.length; i++) {
                        var vmName = listOfVms[i]["name"];
                        this.client.virtualMachines.start(this.resourceGroupName, vmName, this.postOperationCallBack);
                    }
                    break;
                case "Stop":
                    for (var i=0; i<listOfVms.length; i++) {
                        var vmName = listOfVms[i]["name"];
                        this.client.virtualMachines.powerOff(this.resourceGroupName, vmName, this.postOperationCallBack);
                    }
                    break;
                case "Restart":
                    for (var i=0; i<listOfVms.length; i++) {
                        var vmName = listOfVms[i]["name"];
                        this.client.virtualMachines.restart(this.resourceGroupName, vmName, this.postOperationCallBack);
                    }
                    break;
                case "Delete":
                    for (var i=0; i<listOfVms.length; i++) {
                        var vmName = listOfVms[i]["name"];
                        this.client.virtualMachines.deleteMethod(this.resourceGroupName, vmName, this.postOperationCallBack);
                    }
            }
        });
    }
}


var azureResourceGroupDeployment = new AzureResourceGroupDeployment();
azureResourceGroupDeployment.start();
