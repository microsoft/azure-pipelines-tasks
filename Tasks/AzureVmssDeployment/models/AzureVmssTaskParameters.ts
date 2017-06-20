import tl = require("vsts-task-lib/task");
import msRestAzure = require("azure-arm-rest/azure-arm-common");

export default class AzureVmssTaskParameters {

    public action: string;
    public vmssName: string;
    public imageUrl: string;
    public customScriptUrl: string;
    public customScriptCommand: string;
    public subscriptionId: string;
    public credentials: msRestAzure.ApplicationTokenCredentials;

    constructor() {
        try {
            var connectedService = tl.getInput("ConnectedServiceName", true);
            this.subscriptionId = tl.getEndpointDataParameter(connectedService, "SubscriptionId", true);
            this.vmssName = tl.getInput("vmssName", true);
            this.imageUrl = tl.getInput("imageUrl", true);
            this.action = tl.getInput("action");
            this.customScriptUrl = tl.getInput("customScriptUrl");
            this.customScriptCommand = tl.getInput("customScriptCommand");
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
        var credentials = new msRestAzure.ApplicationTokenCredentials(servicePrincipalId, tenantId, servicePrincipalKey, armUrl, envAuthorityUrl);
        return credentials;
    }
}