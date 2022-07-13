import msRestAzure = require('azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-common');
import tl = require("azure-pipelines-task-lib/task");
import util = require("util");

import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-endpoint';

export class KeyVaultTaskParameters {

    public subscriptionId: string;
    public keyVaultName: string;
    public secretsFilter: string[];
    public vaultCredentials: msRestAzure.ApplicationTokenCredentials;
    public keyVaultUrl: string;
    public servicePrincipalId: string;
    public scheme: string;

    private _environments = {
        'AzureStack': 'azurestack'
    }

    public async getKeyVaultTaskParameters() : Promise<KeyVaultTaskParameters> {
        var connectedService = tl.getInput("ConnectedServiceName", true);
        this.subscriptionId = tl.getEndpointDataParameter(connectedService, "SubscriptionId", true);
        this.keyVaultName = tl.getInput("KeyVaultName", true);
        if (this.keyVaultName != encodeURIComponent(this.keyVaultName)){
            throw new Error(tl.loc("InvalidKeyVaultName", this.keyVaultName));
        }
        this.secretsFilter = tl.getDelimitedInput("SecretsFilter", ",", true);
        var azureKeyVaultDnsSuffix = tl.getEndpointDataParameter(connectedService, "AzureKeyVaultDnsSuffix", true);
        if (!azureKeyVaultDnsSuffix) {
            azureKeyVaultDnsSuffix = "vault.azure.net"
        }
        this.servicePrincipalId = tl.getEndpointAuthorizationParameter(connectedService, 'serviceprincipalid', true);
        this.keyVaultUrl = util.format("https://%s.%s", this.keyVaultName, azureKeyVaultDnsSuffix);
        this.scheme = tl.getEndpointAuthorizationScheme(connectedService, false);
        this.vaultCredentials = await this.getVaultCredentials(connectedService);
        return this;
    }

    private async getVaultCredentials(connectedService: string): Promise<msRestAzure.ApplicationTokenCredentials> {
        const endpoint: AzureEndpoint = await new AzureRMEndpoint(connectedService).getEndpoint();
         
        if(!!endpoint.environment && endpoint.environment.toLowerCase() == this._environments.AzureStack) {
            endpoint.applicationTokenCredentials.activeDirectoryResourceId = endpoint.activeDirectoryResourceID.replace("management", "vault");
        } else {
            if (!endpoint.azureKeyVaultServiceEndpointResourceId) {
                endpoint.azureKeyVaultServiceEndpointResourceId = "https://vault.azure.net";
            }
            endpoint.applicationTokenCredentials.baseUrl = endpoint.azureKeyVaultServiceEndpointResourceId;
            endpoint.applicationTokenCredentials.activeDirectoryResourceId = endpoint.azureKeyVaultServiceEndpointResourceId;
        }

        return endpoint.applicationTokenCredentials;
    }
}