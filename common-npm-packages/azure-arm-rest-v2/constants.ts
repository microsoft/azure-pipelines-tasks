export const AzureEnvironments = {
    AzureStack: 'azurestack'
};

export const APPLICATION_INSIGHTS_EXTENSION_NAME: string = "Microsoft.ApplicationInsights.AzureWebSites";

export const productionSlot: string = "production";

export const mysqlApiVersion: string = '2017-12-01';

export const APIVersions = {
    azure_arm_appinsights: '2015-05-01',
    azure_arm_metric_alerts: '2016-03-01'
}

export const KUDU_DEPLOYMENT_CONSTANTS = {
    SUCCESS: 4,
    FAILED: 3
}

export const AzureServicePrinicipalAuthentications = {
    "servicePrincipalKey": "spnKey",
    "servicePrincipalCertificate": "spnCertificate"
}

export const AzureRmEndpointAuthenticationScheme = {
    "ServicePrincipal": "serviceprincipal",
    "ManagedServiceIdentity": "managedserviceidentity",
    "PublishProfile": "publishprofile",
    "WorkloadIdentityFederation": "workloadidentityfederation"
}