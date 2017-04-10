/// <reference path="../../../definitions/node.d.ts" /> 
/// <reference path="../../../definitions/vsts-task-lib.d.ts" /> 

import tl = require("vsts-task-lib/task");
import msRestAzure = require("./../operations/azure-rest/azure-arm-common");

class TokenCredentials {
    private hostUrl: string;
    private patToken: string;

    constructor(hostUrl: string, patToken: string){
        if (typeof hostUrl.valueOf() !== 'string' || !hostUrl) {
            throw new Error(tl.loc("HostUrlCannotBeEmpty"));
        }

        if (typeof patToken.valueOf() !== 'string' || !patToken) {
            throw new Error(tl.loc("PatTokenCannotBeEmpty"));
        }

        this.hostUrl = hostUrl;
        this.patToken = patToken;
    }

    public getPatToken(): string{
        return this.patToken;
    }

    public getHostUrl(): string{
        return this.hostUrl;
    }
}

export class AzureRGTaskParameters {

    public action: string;
    public resourceGroupName: string;
    public location: string;
    public csmFile: string;
    public csmParametersFile: string;
    public templateLocation: string;
    public csmFileLink: string;
    public csmParametersFileLink: string;
    public overrideParameters: string;
    public enableDeploymentPrerequisites: string;
    public deploymentGroupName: string;
    public copyAzureVMTags: boolean;
    public outputVariable: string;
    public subscriptionId: string;
    public deploymentMode: string;
    public credentials: msRestAzure.ApplicationTokenCredentials;
    public deploymentGroupProjectName = "";
    public tokenCredentials: TokenCredentials;

    constructor() {
        try {
            var connectedService = tl.getInput("ConnectedServiceName", true);
            this.subscriptionId = tl.getEndpointDataParameter(connectedService, "SubscriptionId", true);
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
            this.enableDeploymentPrerequisites = tl.getInput("enableDeploymentPrerequisites");
            this.deploymentGroupName = tl.getInput("deploymentGroupName");
            this.copyAzureVMTags = tl.getBoolInput("copyAzureVMTags");
            var deploymentGroupEndpointName = tl.getInput("deploymentGroupEndpoint", false);
            if(deploymentGroupEndpointName){
                this.tokenCredentials = this.getVSTSPatToken(deploymentGroupEndpointName);
            }
            this.outputVariable = tl.getInput("outputVariable");
            this.deploymentMode = tl.getInput("deploymentMode");
            this.credentials = this.getARMCredentials(connectedService);
            this.deploymentGroupProjectName = tl.getInput("project");
        }
        catch (error) {
            throw new Error(tl.loc("ARGD_ConstructorFailed", error.message));
        }
    }

    private getVSTSPatToken(deploymentGroupEndpointName: string): TokenCredentials {
        var endpointAuth = tl.getEndpointAuthorization(deploymentGroupEndpointName, true);
        if (endpointAuth.scheme === 'Token') {
            var hostUrl = tl.getEndpointUrl(deploymentGroupEndpointName, true);
            var patToken: string = endpointAuth.parameters["apitoken"];
            if (typeof hostUrl.valueOf() !== 'string' || !hostUrl) {
                throw new Error(tl.loc("DeploymentGroupEndpointUrlCannotBeEmpty"));
            }

            if (typeof patToken.valueOf() !== 'string' || !patToken) {
                throw new Error(tl.loc("DeploymentGroupEndpointPatTokenCannotBeEmpty"));
            }
            var credentials = new TokenCredentials(hostUrl, patToken);
            return credentials;
        }
        else {
            var msg = tl.loc("OnlyTokenAuthAllowed");
            console.log(msg);
            throw (msg);
        }
    }

    private getARMCredentials(connectedService: string): msRestAzure.ApplicationTokenCredentials {
        var endpointAuth = tl.getEndpointAuthorization(connectedService, true);
        var servicePrincipalId: string = endpointAuth.parameters["serviceprincipalid"];
        var servicePrincipalKey: string = endpointAuth.parameters["serviceprincipalkey"];
        var tenantId: string = endpointAuth.parameters["tenantid"];
        var armUrl: string = tl.getEndpointUrl(connectedService, true);
        var envAuthorityUrl: string = tl.getEndpointDataParameter(connectedService, 'environmentAuthorityUrl', true);
        envAuthorityUrl = (envAuthorityUrl != null) ? envAuthorityUrl : "https://login.windows.net/";
        var credentials = new msRestAzure.ApplicationTokenCredentials(servicePrincipalId, tenantId, servicePrincipalKey, armUrl, envAuthorityUrl);
        return credentials;
    }
}
