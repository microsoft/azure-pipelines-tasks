import tl = require("vsts-task-lib/task");
import msRestAzure = require('azure-arm-rest/azure-arm-common');
import { AzureRMEndpoint } from 'azure-arm-rest/azure-arm-endpoint';

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

class AgentServiceUserCredentials {
    private userName: string;
    private password: string;

    constructor(userName: string, password: string) {
        this.userName = userName || "";
        this.password = password || "";
    }

    public getUserName(): string {
        return this.userName;
    }

    public getPassword(): string {
        return this.password;
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
    public endpointPortalUrl: string;
    public deploymentName: string;
    public deploymentMode: string;
    public credentials: msRestAzure.ApplicationTokenCredentials;
    public deploymentGroupProjectName = "";
    public tokenCredentials: TokenCredentials;
    public deploymentOutputs: string;
    public agentServiceUserCredentials: AgentServiceUserCredentials;
    public runAgentServiceAsUser: boolean;
    public addSpnToEnvironment: boolean;
    public connectedService: string;

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
        var azureEndpoint = await new AzureRMEndpoint(connectedService).getEndpoint();
        return azureEndpoint.applicationTokenCredentials;
    }

    public async getAzureRGTaskParameters() : Promise<AzureRGTaskParameters> 
    {
        try {
            this.connectedService = tl.getInput("ConnectedServiceName", true);
            var endpointTelemetry = '{"endpointId":"' + this.connectedService + '"}';
            console.log("##vso[telemetry.publish area=TaskEndpointId;feature=AzureResourceGroupDeployment]" + endpointTelemetry);
            this.subscriptionId = tl.getEndpointDataParameter(this.connectedService, "SubscriptionId", true);
            this.endpointPortalUrl = tl.getEndpointDataParameter(this.connectedService, "armManagementPortalUrl", true);
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
            if(this.enableDeploymentPrerequisites && this.enableDeploymentPrerequisites == "ConfigureVMWithDGAgent"){
                this.tokenCredentials = this.getVSTSPatToken(deploymentGroupEndpointName);
            }
            this.runAgentServiceAsUser = tl.getBoolInput("runAgentServiceAsUser");
            var userName = tl.getInput("userName");
            if(this.runAgentServiceAsUser && !userName){
                throw tl.loc("UserNameCannotBeNull");
            }
            var password = tl.getInput("password");
            this.agentServiceUserCredentials = new AgentServiceUserCredentials(userName, password);
            
            this.outputVariable = tl.getInput("outputVariable");
            this.deploymentName = tl.getInput("deploymentName");
            this.deploymentMode = tl.getInput("deploymentMode");
            this.credentials = await this.getARMCredentials(this.connectedService);
            this.deploymentGroupProjectName = tl.getInput("project");
            this.deploymentOutputs = tl.getInput("deploymentOutputs");
            this.addSpnToEnvironment = tl.getBoolInput("addSpnToEnvironment", false);
            return this;
        } catch (error) {
            throw new Error(tl.loc("ARGD_ConstructorFailed", error.message));
        }
    }    
}
