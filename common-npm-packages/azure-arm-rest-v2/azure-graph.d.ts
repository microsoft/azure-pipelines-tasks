import msRestAzure = require("./azure-arm-common");
import azureServiceClient = require("./AzureServiceClient");
export declare class GraphManagementClient extends azureServiceClient.ServiceClient {
    servicePrincipals: ServicePrincipals;
    constructor(credentials: msRestAzure.ApplicationTokenCredentials, baseUri?: any, options?: any);
    protected validateInputs(subscriptionId: string): void;
}
export declare class ServicePrincipals {
    private client;
    constructor(graphClient: GraphManagementClient);
    GetServicePrincipal(options: any): Promise<any>;
}
