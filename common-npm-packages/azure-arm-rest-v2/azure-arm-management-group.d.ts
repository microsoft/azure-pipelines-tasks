import msRestAzure = require('./azure-arm-common');
import azureServiceClientBase = require('./AzureServiceClientBase');
import depolymentsBase = require('./DeploymentsBase');
export declare class ManagementGroupManagementClient extends azureServiceClientBase.AzureServiceClientBase {
    managementGroupId: string;
    constructor(credentials: msRestAzure.ApplicationTokenCredentials, managementGroupId: string, options?: any);
    getRequestUri(uriFormat: string, parameters: {}, queryParameters?: string[], apiVersion?: string): string;
    private validateInputs(managementGroupId);
}
export declare class ManagementGroupDeployments extends depolymentsBase.DeploymentsBase {
    protected client: ManagementGroupManagementClient;
    constructor(client: ManagementGroupManagementClient);
    createOrUpdate(deploymentName: any, deploymentParameters: any, callback: any): void;
    validate(deploymentName: any, deploymentParameters: any, callback: any): void;
}
