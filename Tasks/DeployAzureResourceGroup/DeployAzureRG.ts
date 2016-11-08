/// <reference path="../../definitions/node.d.ts" /> 
/// <reference path="../../definitions/Q.d.ts" /> 
/// <reference path="../../definitions/vsts-task-lib.d.ts" /> 
 
import tl = require("vsts-task-lib/task");
import fs = require("fs");
import util = require("util");

var msRestAzure = require("ms-rest-azure");

import virtualMachine = require("./VirtualMachine");
import resourceGroup = require("./ResourceGroup");
import env = require("./Environment");

export class AzureResourceGroupDeployment {

    public connectedServiceNameSelector:string;
    public action:string;
    public resourceGroupName:string;
    public location:string;
    public csmFile:string;
    public csmParametersFile:string;
    public templateLocation:string;
    public csmFileLink:string;
    public csmParametersFileLink:string;
    public overrideParameters:string;
    public enableDeploymentPrerequisitesForCreate:boolean;
    public enableDeploymentPrerequisitesForSelect:boolean;
    public outputVariable:string;
    public subscriptionId:string;
    public connectedService:string;
    public quickStartTemplate:string;
    public commitID:string;
    public isLoggedIn:boolean = false;
    public deploymentMode:string;
    public credentials;
    
    constructor() {
        try { 
            this.connectedServiceNameSelector = tl.getInput("ConnectedServiceNameSelector", true);
            this.connectedService = null;
            this.connectedService = tl.getInput("ConnectedServiceName");
            this.action = tl.getInput("action");
            this.resourceGroupName = tl.getInput("resourceGroupName");
            this.location = tl.getInput("location");
            this.csmFile = tl.getPathInput("csmFile");
            this.csmParametersFile = tl.getPathInput("csmParametersFile");
            this.csmFileLink = tl.getInput("csmFileLink");
            this.csmParametersFileLink = tl.getInput("csmParametersFile");
            this.templateLocation = tl.getInput("templateLocation");
            this.overrideParameters = tl.getInput("overrideParameters");
            this.enableDeploymentPrerequisitesForCreate = tl.getBoolInput("enableDeploymentPrerequisitesForCreate");
            this.enableDeploymentPrerequisitesForSelect = tl.getBoolInput("enableDeploymentPrerequisitesForSelect");
            this.outputVariable = tl.getInput("outputVariable");
            this.commitID = tl.getInput("commitID");
            this.quickStartTemplate = tl.getInput("quickStartTemplate");
            this.subscriptionId = tl.getEndpointDataParameter(this.connectedService, "SubscriptionId", true);    
            this.deploymentMode = tl.getInput("deploymentMode");
            this.credentials = this.getARMCredentials();
        }
        catch (error) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("ARGD_ConstructorFailed", error.message));
        }
    }

    public execute() {
        switch (this.action) {
           case "Create Or Update Resource Group": 
           case "DeleteRG":
           case "Select Resource Group":
                new resourceGroup.ResourceGroup(this);
                break;
           case "Start":
           case "Stop":
           case "Restart":
           case "Delete":
               new virtualMachine.VirtualMachine(this.resourceGroupName, this.action, this.subscriptionId, this.connectedService, this.getARMCredentials());
               break;
           default:
               tl.setResult(tl.TaskResult.Succeeded, tl.loc("InvalidAction"));
        }
    }

     private getARMCredentials() {
        var endpointAuth = tl.getEndpointAuthorization(this.connectedService, true);
        var servicePrincipalId:string = endpointAuth.parameters["serviceprincipalid"];
        var servicePrincipalKey:string = endpointAuth.parameters["serviceprincipalkey"];
        var tenantId:string = endpointAuth.parameters["tenantid"];
        var credentials = new msRestAzure.ApplicationTokenCredentials(servicePrincipalId, tenantId, servicePrincipalKey);
        return credentials;
    }
}
