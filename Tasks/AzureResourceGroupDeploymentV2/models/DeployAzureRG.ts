import tl = require("vsts-task-lib/task");
import msRestAzure = require('azure-arm-rest/azure-arm-common');

var azureStackUtility = require ('azurestack-common/azurestackrestutility.js'); 
var azureStackEnvironment = "AzureStack";

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
    public deploymentOutputs: string;

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

    private async getARMCredentials(connectedService: string): Promise<msRestAzure.ApplicationTokenCredentials> {
        var servicePrincipalId: string = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalid", false);
        var servicePrincipalKey: string = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalkey", false);
        var tenantId: string = tl.getEndpointAuthorizationParameter(connectedService, "tenantid", false);
        var armUrl: string = tl.getEndpointUrl(connectedService, true);
        var envAuthorityUrl: string = tl.getEndpointDataParameter(connectedService, 'environmentAuthorityUrl', true);
        var environment: string = tl.getEndpointDataParameter(connectedService, 'environment', true);
        var activeDirectoryResourceId: string = tl.getEndpointDataParameter(connectedService, 'activeDirectoryServiceEndpointResourceId', true);
        var isAzureStackEnvironment = false;

        if(environment != null && environment.toLowerCase() == azureStackEnvironment.toLowerCase()) {
            isAzureStackEnvironment = true;
            if(!envAuthorityUrl || !activeDirectoryResourceId) {
                var endPoint =  await azureStackUtility.initializeAzureStackData({"url":armUrl});
                envAuthorityUrl = endPoint["environmentAuthorityUrl"];
                activeDirectoryResourceId = endPoint["activeDirectoryServiceEndpointResourceId"];
                
                if(envAuthorityUrl == null) {
                    throw tl.loc("UnableToFetchAuthorityURL");
                }

                if(activeDirectoryResourceId == null) {
                    throw tl.loc("UnableToFetchActiveDirectory");
                }
            } 
        } else {
            envAuthorityUrl = (envAuthorityUrl != null) ? envAuthorityUrl : "https://login.windows.net/";
            activeDirectoryResourceId = armUrl;
        }

        var credentials = new msRestAzure.ApplicationTokenCredentials(servicePrincipalId, tenantId, servicePrincipalKey, armUrl, envAuthorityUrl, activeDirectoryResourceId, isAzureStackEnvironment);
        return credentials;
    }

    public async getAzureRGTaskParameters() : Promise<AzureRGTaskParameters> 
    {
        try {
            var connectedService = tl.getInput("ConnectedServiceName", true);
            var endpointTelemetry = '{"endpointId":"' + connectedService + '"}';
            console.log("##vso[telemetry.publish area=TaskEndpointId;feature=AzureResourceGroupDeployment]" + endpointTelemetry);
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
            this.credentials = await this.getARMCredentials(connectedService);
            this.deploymentGroupProjectName = tl.getInput("project");
            this.deploymentOutputs = tl.getInput("deploymentOutputs");
            return this;
        } catch (error) {
            throw new Error(tl.loc("ARGD_ConstructorFailed", error.message));
        }
    }    
}
