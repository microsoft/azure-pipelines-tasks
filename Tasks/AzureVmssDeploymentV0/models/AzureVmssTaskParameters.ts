import tl = require("azure-pipelines-task-lib/task");
import msRestAzure = require("azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-common");
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-endpoint';

export default class AzureVmssTaskParameters {

    public action: string;
    public vmssName: string;
    public vmssOsType: string;
    public imageUrl: string;
    public customScriptsDirectory: string;
    public customScript: string;
    public customScriptArguments: string;
    public customScriptsStorageAccount: string;
    public skipArchivingCustomScripts: boolean;
    public subscriptionId: string;
    public credentials: msRestAzure.ApplicationTokenCredentials;

    public async getAzureVmssTaskParameters() {
        try {
            var connectedService = tl.getInput("ConnectedServiceName", true);
            this.subscriptionId = tl.getEndpointDataParameter(connectedService, "SubscriptionId", true);
            this.vmssName = tl.getInput("vmssName", true);
            this.vmssOsType = tl.getInput("vmssOsType", false);
            this.imageUrl = tl.getInput("imageUrl", false);
            this.action = tl.getInput("action");
            this.customScriptsDirectory = tl.getInput("customScriptsDirectory");
            this.customScript = tl.getInput("customScript");
            this.customScriptArguments = tl.getInput("customScriptArguments");
            this.customScriptsStorageAccount = tl.getInput("customScriptsStorageAccount");
            this.skipArchivingCustomScripts = tl.getBoolInput("skipArchivingCustomScripts");
            this.credentials = await this.getARMCredentials(connectedService);

            return this;
        }
        catch (error) {
            throw new Error(tl.loc("TaskConstructorFailed", error.message));
        }
    }

    private async getARMCredentials(connectedService: string): Promise<msRestAzure.ApplicationTokenCredentials> {
        var azureEndpoint = await new AzureRMEndpoint(connectedService).getEndpoint();
        return azureEndpoint.applicationTokenCredentials;
    }
}