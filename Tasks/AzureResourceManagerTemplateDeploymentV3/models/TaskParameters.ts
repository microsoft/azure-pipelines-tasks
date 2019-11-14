import tl = require("azure-pipelines-task-lib/task");
import msRestAzure = require('azure-arm-rest-v2/azure-arm-common');
import { AzureRMEndpoint } from 'azure-arm-rest-v2/azure-arm-endpoint';

export class TaskParameters {

    public action: string;
    public resourceGroupName: string;
    public location: string;
    public csmFile: string;
    public csmParametersFile: string;
    public templateLocation: string;
    public csmFileLink: string;
    public csmParametersFileLink: string;
    public overrideParameters: string;
    public outputVariable: string;
    public subscriptionId: string;
    public endpointPortalUrl: string;
    public deploymentName: string;
    public deploymentMode: string;
    public credentials: msRestAzure.ApplicationTokenCredentials;
    public deploymentOutputs: string;
    public addSpnToEnvironment: boolean;
    public connectedService: string;
    public deploymentScope: string;
    public managementGroupId: string;

    private async getARMCredentials(connectedService: string): Promise<msRestAzure.ApplicationTokenCredentials> {
        var azureEndpoint = await new AzureRMEndpoint(connectedService).getEndpoint();
        return azureEndpoint.applicationTokenCredentials;
    }

    public async getTaskParameters() : Promise<TaskParameters>
    {
        try {

            //Deployment Scope
            this.deploymentScope = tl.getInput("deploymentScope");
            if(!this.deploymentScope){
                this.deploymentScope = "Resource Group";
            }

            var resourceGroupNameInServiceConnection;

            //Service Connection
            this.connectedService = tl.getInput("ConnectedServiceName", true);
            var endpointTelemetry = '{"endpointId":"' + this.connectedService + '"}';
            console.log("##vso[telemetry.publish area=TaskEndpointId;feature=AzureResourceManagerTemplateDeployment]" + endpointTelemetry);
            this.endpointPortalUrl = tl.getEndpointDataParameter(this.connectedService, "armManagementPortalUrl", true);
            var armServiceConnectionScope = tl.getEndpointDataParameter(this.connectedService, 'ScopeLevel', true);
            if(!!armServiceConnectionScope && armServiceConnectionScope === "Subscription"){
                var armServiceConnectionAuthScope = tl.getEndpointAuthorizationParameter(this.connectedService, 'scope', true);
                if(!!armServiceConnectionAuthScope){
                    var armServiceConnectionAuthScopeSplit = armServiceConnectionAuthScope.split("/");
                    if(!!armServiceConnectionAuthScopeSplit[4]){
                        armServiceConnectionScope = "Resource Group";
                        resourceGroupNameInServiceConnection = armServiceConnectionAuthScopeSplit[4];
                    }
                }
            }
            console.log(tl.loc("ARMServiceConnectionScope", armServiceConnectionScope));

            //Management Group Id
            if(this.deploymentScope === "Management Group"){
                this.managementGroupId = tl.getEndpointDataParameter(this.connectedService, "ManagementGroupId", false);
            }

            //Subscripion Id
            this.subscriptionId = tl.getInput("subscriptionName");
            if(!this.subscriptionId && (this.deploymentScope === "Subscription" || this.deploymentScope === "Resource Group")) {
                this.subscriptionId = tl.getEndpointDataParameter(this.connectedService, "SubscriptionId", false);
            }

            //Resource group name
            this.resourceGroupName = tl.getInput("resourceGroupName");
            if(!this.resourceGroupName && this.deploymentScope === "Resource Group"){
                this.resourceGroupName = resourceGroupNameInServiceConnection;
                if(!this.resourceGroupName){
                    throw new Error(tl.loc("ResourceGroupNameNotProvided"));
                }
            }

            //Location
            this.location = tl.getInput("location");
            if(!this.location && this.deploymentScope === "Resource Group" && this.action != "DeleteRG"){
                throw new Error(tl.loc("LocationNotProvided"));
            }

            //Deployment mode
            this.deploymentMode = tl.getInput("deploymentMode");
            if(!!this.deploymentMode && this.deploymentMode === "Complete" && this.deploymentScope != "Resource Group"){
                throw new Error(tl.loc("CompleteDeploymentModeNotSupported", this.deploymentScope));
            }

            this.templateLocation = tl.getInput("templateLocation");
            if (this.templateLocation === "Linked artifact") {
                this.csmFile = tl.getPathInput("csmFile");
                this.csmParametersFile = tl.getPathInput("csmParametersFile");
            } else {
                this.csmFileLink = tl.getInput("csmFileLink");
                this.csmParametersFileLink = tl.getInput("csmParametersFileLink");
            }
            this.overrideParameters = tl.getInput("overrideParameters");
            this.outputVariable = tl.getInput("outputVariable");
            this.deploymentName = tl.getInput("deploymentName");
            this.credentials = await this.getARMCredentials(this.connectedService);
            this.deploymentOutputs = tl.getInput("deploymentOutputs");
            this.addSpnToEnvironment = tl.getBoolInput("addSpnToEnvironment", false);
            this.action = tl.getInput("action");

            return this;
        } catch (error) {
            throw new Error(tl.loc("ARGD_ConstructorFailed", error.message));
        }
    }
}
