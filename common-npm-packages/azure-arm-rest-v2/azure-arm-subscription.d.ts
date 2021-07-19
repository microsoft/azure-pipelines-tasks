import msRestAzure = require('./azure-arm-common');
import azureServiceClientBase = require('./AzureServiceClientBase');
import depolymentsBase = require('./DeploymentsBase');
export declare class SubscriptionManagementClient extends azureServiceClientBase.AzureServiceClientBase {
    subscriptionId: string;
    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: string, options?: any);
    getRequestUri(uriFormat: string, parameters: {}, queryParameters?: string[], apiVersion?: string): string;
    private validateInputs(subscriptionId);
}
export declare class SubscriptionDeployments extends depolymentsBase.DeploymentsBase {
    protected client: SubscriptionManagementClient;
    constructor(client: SubscriptionManagementClient);
    createOrUpdate(deploymentParameters: any, parameters: any, callback: any): void;
    validate(deploymentParameters: any, parameters: any, callback: any): void;
}
