/// <reference path="../../definitions/node.d.ts" /> 
/// <reference path="../../definitions/vsts-task-lib.d.ts" /> 
 
import tl = require("vsts-task-lib/task");
import fs = require("fs");
import util = require("util");

var msRestAzure = require("ms-rest-azure");


export class AzureRGTaskParameters {

    public action:string;
    public resourceGroupName:string;
    public location:string;
    public csmFile:string;
    public csmParametersFile:string;
    public templateLocation:string;
    public csmFileLink:string;
    public csmParametersFileLink:string;
    public overrideParameters:string;
    public enableDeploymentPrerequisites:boolean;
    public outputVariable:string;
    public subscriptionId:string;
    public connectedService:string;
    public isLoggedIn:boolean = false;
    public deploymentMode:string;
    public credentials;
    
    constructor() {
        try { 
            this.connectedService = tl.getInput("ConnectedServiceName", true);
            this.subscriptionId = tl.getEndpointDataParameter(this.connectedService, "SubscriptionId", true);   
            this.resourceGroupName = tl.getInput("resourceGroupName", true);
            this.action = tl.getInput("action");
            this.location = tl.getInput("location");
            this.templateLocation = tl.getInput("templateLocation");
            if (this.templateLocation === "Linked artifact") {
                this.csmFile = tl.getPathInput("csmFile");
                this.csmParametersFile = tl.getPathInput("csmParametersFile");
            } else {
                this.csmFileLink = tl.getInput("csmFileLink");
                this.csmParametersFileLink = tl.getInput("csmParametersFileLink");
            }
            this.overrideParameters = tl.getInput("overrideParameters");
            this.enableDeploymentPrerequisites = tl.getBoolInput("enableDeploymentPrerequisites");
            this.outputVariable = tl.getInput("outputVariable");
            this.deploymentMode = tl.getInput("deploymentMode");
            this.credentials = this.getARMCredentials();
        }
        catch (error) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("ARGD_ConstructorFailed", error.message));
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
