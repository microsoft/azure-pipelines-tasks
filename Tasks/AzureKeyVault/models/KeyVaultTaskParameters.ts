/// <reference path="../typings/index.d.ts" />

import msRestAzure = require('azure-arm-rest/azure-arm-common');
import tl = require("vsts-task-lib/task");
import util = require("util")

export class KeyVaultTaskParameters {

    public subscriptionId: string;
    public keyVaultName: string;
    public secretsFilter: string[];
    public vaultCredentials: msRestAzure.ApplicationTokenCredentials;
    public keyVaultUrl: string;

    constructor() {
        var connectedService = tl.getInput("ConnectedServiceName", true);
        this.subscriptionId = tl.getEndpointDataParameter(connectedService, "SubscriptionId", true);
        this.keyVaultName = tl.getInput("KeyVaultName", true);
        this.secretsFilter = tl.getDelimitedInput("SecretsFilter", ",", true);
        var azureKeyVaultDnsSuffix = tl.getEndpointDataParameter(connectedService, "AzureKeyVaultDnsSuffix", true);

        this.keyVaultUrl = util.format("https://%s.%s", this.keyVaultName, azureKeyVaultDnsSuffix);
        this.vaultCredentials = this.getVaultCredentials(connectedService, azureKeyVaultDnsSuffix);
    }

    private getVaultCredentials(connectedService: string, azureKeyVaultDnsSuffix: string): msRestAzure.ApplicationTokenCredentials {
        var vaultUrl = util.format("https://%s", azureKeyVaultDnsSuffix);

        var servicePrincipalId: string = tl.getEndpointAuthorizationParameter(connectedService, 'serviceprincipalid', false);
        var servicePrincipalKey: string = tl.getEndpointAuthorizationParameter(connectedService, 'serviceprincipalkey', false);
        var tenantId: string = tl.getEndpointAuthorizationParameter(connectedService, 'tenantid', false);
        var armUrl: string = tl.getEndpointUrl(connectedService, true);
        var envAuthorityUrl: string = tl.getEndpointDataParameter(connectedService, 'environmentAuthorityUrl', true);
        envAuthorityUrl = (envAuthorityUrl != null) ? envAuthorityUrl : "https://login.windows.net/";
        var credentials = new msRestAzure.ApplicationTokenCredentials(servicePrincipalId, tenantId, servicePrincipalKey, vaultUrl, envAuthorityUrl, vaultUrl, false);
        return credentials;
    }
}
