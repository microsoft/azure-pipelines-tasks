import tl = require("vsts-task-lib/task");
import msRestAzure = require("azure-arm-rest/azure-arm-common");

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

    constructor() {
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
            this.credentials = this.getARMCredentials(connectedService);
        }
        catch (error) {
            throw new Error(tl.loc("TaskConstructorFailed", error.message));
        }
    }

    private getARMCredentials(connectedService: string): msRestAzure.ApplicationTokenCredentials {
        var servicePrincipalId: string = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalid", false);
        var servicePrincipalKey: string = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalkey", false);
        var tenantId: string = tl.getEndpointAuthorizationParameter(connectedService, "tenantid", false);
        var armUrl: string = tl.getEndpointUrl(connectedService, true);
        var envAuthorityUrl: string = tl.getEndpointDataParameter(connectedService, 'environmentAuthorityUrl', true);
        envAuthorityUrl = (envAuthorityUrl != null) ? envAuthorityUrl : "https://login.windows.net/";
        var activeDirectoryResourceId: string = tl.getEndpointDataParameter(connectedService, 'activeDirectoryServiceEndpointResourceId', false);
        activeDirectoryResourceId = (activeDirectoryResourceId != null) ? activeDirectoryResourceId : armUrl;
        var credentials = new msRestAzure.ApplicationTokenCredentials(servicePrincipalId, tenantId, servicePrincipalKey, armUrl, envAuthorityUrl, activeDirectoryResourceId, false);
        return credentials;
    }
}