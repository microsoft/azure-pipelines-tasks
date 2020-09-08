import { AzureEndpoint } from './azureModels';
import msRestAzure = require('./azure-arm-common');
import azureServiceClient = require('./AzureServiceClient');
import azureServiceClientBase = require('./AzureServiceClientBase');
import depolymentsBase = require('./DeploymentsBase');
export declare class ResourceManagementClient extends azureServiceClient.ServiceClient {
    resourceGroup: ResourceGroup;
    resourceGroupName: string;
    constructor(credentials: msRestAzure.ApplicationTokenCredentials, resourceGroupName: string, subscriptionId: string, options?: any);
}
export declare class Resources {
    private _client;
    constructor(endpoint: AzureEndpoint);
    getResources(resourceType: string, resourceName: string): Promise<any[]>;
}
export declare class ResourceGroup {
    private client;
    constructor(armClient: ResourceManagementClient);
    checkExistence(callback: azureServiceClientBase.ApiCallback): void;
    deleteMethod(callback: azureServiceClientBase.ApiCallback): void;
    createOrUpdate(parameters: any, callback: azureServiceClientBase.ApiCallback): void;
}
export declare class ResourceGroupDeployments extends depolymentsBase.DeploymentsBase {
    protected client: ResourceManagementClient;
    constructor(client: ResourceManagementClient);
    createOrUpdate(deploymentName: any, deploymentParameters: any, callback: any): any;
    validate(deploymentName: any, deploymentParameters: any, callback: any): any;
}
