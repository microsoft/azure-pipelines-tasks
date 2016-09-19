/// <reference path="../../definitions/node.d.ts" /> 
/// <reference path="../../definitions/Q.d.ts" /> 
/// <reference path="../../definitions/vsts-task-lib.d.ts" /> 
 
import path = require("path");
import tl = require("vsts-task-lib/task");
import fs = require("fs");
import util = require("util");

var minimist = require("minimist");
var msRestAzure = require("ms-rest-azure");
var arm_resource = require("azure-arm-resource");
var computeManagementClient = require('azure-arm-compute');

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
            if(this.connectedServiceNameSelector === "ConnectedServiceName"){
                this.connectedService = tl.getInput("ConnectedServiceName");
            }else{
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
        }catch(error){
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
           default: 
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
        credentials = new msRestAzure.ApplicationTokenCredentials(servicePrincipalId, tenantId, servicePrincipalKey);
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
        var rmClient = new arm_resource.ResourceManagementClient(credentials, this.subscriptionId); 
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

    private deleteResourceGroup(){
        var credentials = this.getRMCredentials();
        var rmClient = new arm_resource.ResourceManagementClient(credentials, this.subscriptionId);
        rmClient.resourceGroups.deleteMethod(this.resourceGroupName,(error, result, request, response) =>{
            if (error){
                tl.setResult(tl.TaskResult.Failed, tl.loc("Deletion of RG failed :"+ this.resourceGroupName));
                return;
            }
            tl.setResult(tl.TaskResult.Succeeded, tl.loc("Successfully deleted "+ this.resourceGroupName));
        });
    }

    private VMActions(){
        var azureCredentials = msRestAzure.ServiceClient(this.getRMCredentials());
        var client = new computeManagementClient(azureCredentials, this.subscriptionId);
        client.virtualMachines.list(this.resourceGroupName, (error, result, request, response) => {
            var list = [];
            for (var i=0; i<result.length; i++) {
                var resource = result[i];
                list = list.concat(resource["name"]);
            }
            switch (this.action){
                case "Start":
                    this.startAllVMs(client, list);
                    break;
                case "Stop":
                    this.shutdownAllVMs(client,list);
                    break;
                case "Restart":
                    this.restartAllVMs(client,list);
                    break;
                case "Delete":
                    this.deleteAllVMs(client,list);
                    break;
                default:
                    tl.setResult(tl.TaskResult.Failed, tl.loc("InvalidAction"));
            }

        });
    }

    private startAllVMs(client,listOfVms){
        for (var i=0; i<listOfVms.length; i++){
            var vmName = listOfVms[i];
            client.virtualMachines.start(this.resourceGroupName, vmName, (error,result,request,response)=>{
                if (error){
                    tl.setResult(tl.TaskResult.Failed, tl.loc("CouldNotStartVM", vmName));
                }
            });
        }
        tl.setResult(tl.TaskResult.Succeeded, tl.loc("SuccessfullyStartedVM", vmName));
    }

    private restartAllVMs(client,listOfVms){
        for (var i=0; i<listOfVms.length; i++){
            var vmName = listOfVms[i];
            client.virtualMachines.restart(this.resourceGroupName, vmName, (error,result,request,response)=>{
                if (error){
                    tl.setResult(tl.TaskResult.Failed, tl.loc("CouldNotRestartVM", vmName));
                }
            });
        }
        tl.setResult(tl.TaskResult.Succeeded, tl.loc("SuccessfullyRestartedVM", vmName));
    }

    private shutdownAllVMs(client,listOfVms){
        for (var i=0; i<listOfVms.length; i++){
            var vmName = listOfVms[i];
            client.virtualMachines.powerOff(this.resourceGroupName, vmName, (error,result,request,response)=>{
                if (error){
                    tl.setResult(tl.TaskResult.Failed, tl.loc("CouldNotShutdownVM", vmName));
                }
            });
        }
        tl.setResult(tl.TaskResult.Succeeded, tl.loc("SuccessfullyShutdownVM", vmName));
    }

    private deleteAllVMs(client,listOfVms){
        for (var i=0; i<listOfVms.length; i++){
            var vmName = listOfVms[i];
            client.virtualMachines.deleteMethod(this.resourceGroupName, vmName, (error,result,request,response)=>{
                if (error){
                    tl.setResult(tl.TaskResult.Failed, tl.loc("CouldNotDeleteVM", vmName));
                }
            });
        }
        tl.setResult(tl.TaskResult.Succeeded, tl.loc("SuccessfullyDeleteVM", vmName));
    }

}

var controller = new deployAzureRG();
controller.start();