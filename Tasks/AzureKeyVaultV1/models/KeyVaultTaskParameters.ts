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
    public servicePrincipalId: string;
    public scheme: string;

    constructor() {
        var connectedService = tl.getInput("ConnectedServiceName", true);
        this.subscriptionId = tl.getEndpointDataParameter(connectedService, "SubscriptionId", true);
        this.keyVaultName = tl.getInput("KeyVaultName", true);
        this.secretsFilter = tl.getDelimitedInput("SecretsFilter", ",", true);
        var azureKeyVaultDnsSuffix = tl.getEndpointDataParameter(connectedService, "AzureKeyVaultDnsSuffix", true);

        this.servicePrincipalId = tl.getEndpointAuthorizationParameter(connectedService, 'serviceprincipalid', true);
        this.keyVaultUrl = util.format("https://%s.%s", this.keyVaultName, azureKeyVaultDnsSuffix);
        this.scheme = tl.getEndpointAuthorizationScheme(connectedService, false);
        this.vaultCredentials = this.getVaultCredentials(connectedService, azureKeyVaultDnsSuffix);
    }

    private getVaultCredentials(connectedService: string, azureKeyVaultDnsSuffix: string): msRestAzure.ApplicationTokenCredentials {
        var vaultUrl = util.format("https://%s", azureKeyVaultDnsSuffix);

        var servicePrincipalKey: string = tl.getEndpointAuthorizationParameter(connectedService, 'serviceprincipalkey', true);
        var tenantId: string = tl.getEndpointAuthorizationParameter(connectedService, 'tenantid', false);
        var armUrl: string = tl.getEndpointUrl(connectedService, true);
        var envAuthorityUrl: string = tl.getEndpointDataParameter(connectedService, 'environmentAuthorityUrl', true);
        envAuthorityUrl = (envAuthorityUrl != null) ? envAuthorityUrl : "https://login.windows.net/";
        var msiClientId = tl.getEndpointDataParameter(connectedService, 'msiclientId', true);
        var credentials = new msRestAzure.ApplicationTokenCredentials(this.servicePrincipalId, tenantId, servicePrincipalKey, vaultUrl, envAuthorityUrl, vaultUrl, false, this.scheme , msiClientId);
        return credentials;
    }
}