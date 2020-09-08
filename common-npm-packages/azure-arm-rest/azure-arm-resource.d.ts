import { AzureEndpoint } from './azureModels';
import msRestAzure = require('./azure-arm-common');
import azureServiceClient = require('./AzureServiceClient');
export declare class ResourceManagementClient extends azureServiceClient.ServiceClient {
    deployments: Deployments;
    resourceGroups: ResourceGroups;
    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: string, options?: any);
}
export declare class Resources {
    private _client;
    constructor(endpoint: AzureEndpoint);
    getResources(resourceType: string, resourceName: string): Promise<any[]>;
}
export declare class ResourceGroups {
    private client;
    constructor(armClient: ResourceManagementClient);
    checkExistence(resourceGroupName: string, callback: azureServiceClient.ApiCallback): void;
    deleteMethod(resourceGroupName: string, callback: azureServiceClient.ApiCallback): void;
    createOrUpdate(resourceGroupName: string, parameters: any, callback: azureServiceClient.ApiCallback): void;
}
export declare class Deployments {
    private client;
    constructor(client: ResourceManagementClient);
    createOrUpdate(resourceGroupName: any, deploymentName: any, parameters: any, callback: any): any;
    get(resourceGroupName: any, deploymentName: any, callback: any): void;
    validate(resourceGroupName: any, deploymentName: any, parameters: any, callback: any): any;
}
