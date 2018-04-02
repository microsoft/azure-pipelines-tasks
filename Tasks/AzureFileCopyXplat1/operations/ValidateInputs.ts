import tl = require("vsts-task-lib/task");
import msRestAzure = require('azure-arm-rest/azure-arm-common');

export class AzureFileCopyXplatTaskParameters {
    public connectedService: string;
    public armCredentials: msRestAzure.ApplicationTokenCredentials;
    public action: string;
    public sourcePath: string;
    public storageAccount: string;
    public containerName: string;
    public containerNameScripts: string;
    public blobPrefix: string;
    public cloudService: string;
    public resourceGroupName: string;
    public resourceFilteringMethod: string;
    public machineNamesOrTags: string;
    public targetPathWin: string;
    public targetPathLinux: string;
    public additionalArguments: string;
    public cleanTargetBeforeCopy: boolean;
    public destinationPath: string;
    public outputStorageUri: string;
    public outputStorageContainerSasToken: string;
    public subscriptionId: string;

    constructor() {
        try {
            this.connectedService = tl.getInput("ConnectedServiceNameARM", true);
            this.sourcePath = tl.getInput("SourcePath");
            this.armCredentials = this.getARMCredentials(this.connectedService);
            this.action = tl.getInput("Action", true);
            this.storageAccount = tl.getInput("StorageAccount", true);
            this.containerName = tl.getInput("ContainerName");
            if (this.action === "ToAzureVMs") {
                this.containerName = Math.random().toString(36).substring(2);
                this.containerNameScripts = Math.random().toString(36).substring(2);
            }
            this.blobPrefix = tl.getInput("BlobPrefix");
            this.cloudService = tl.getInput("CloudService");
            this.resourceGroupName = tl.getInput("ResourceGroup");
            this.resourceFilteringMethod = tl.getInput("ResourceFilteringMethod");
            this.machineNamesOrTags = tl.getInput("MachineNamesOrTags");
            this.targetPathWin = tl.getInput("TargetPathWin");
            this.targetPathLinux = tl.getInput("TargetPathLinux");
            this.additionalArguments = tl.getInput("AdditionalArguments");
            if(!this.additionalArguments){
                this.additionalArguments = "";
            }
            this.cleanTargetBeforeCopy = tl.getBoolInput("CleanTargetBeforeCopy");
            this.destinationPath = tl.getInput("DestinationPath");
            this.outputStorageUri = tl.getInput("OutputStorageUri");
            this.outputStorageContainerSasToken = tl.getInput("OutputStorageContainerSasToken");
        }
        catch (error) {
            throw new Error(tl.loc("AFCX_FetchingTaskInputParametersFailed", error.message));
        }
    }

    private getARMCredentials(connectedService: string): msRestAzure.ApplicationTokenCredentials {
        var servicePrincipalId: string = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalid", false);
        var servicePrincipalKey: string = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalkey", false);
        this.subscriptionId = tl.getEndpointDataParameter(connectedService, "SubscriptionId", true);
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