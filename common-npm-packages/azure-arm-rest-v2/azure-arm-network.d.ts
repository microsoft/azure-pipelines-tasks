import msRestAzure = require("./azure-arm-common");
import azureServiceClient = require("./AzureServiceClient");
import azureServiceClientBase = require("./AzureServiceClientBase");
export declare class NetworkManagementClient extends azureServiceClient.ServiceClient {
    networkSecurityGroups: networkSecurityGroups;
    networkInterfaces: NetworkInterfaces;
    publicIPAddresses: publicIPAddresses;
    loadBalancers: loadBalancers;
    securityRules: securityRules;
    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: any, baseUri?: any, options?: any);
}
export declare class loadBalancers {
    private client;
    constructor(client: any);
    list(resourceGroupName: string, callback: azureServiceClientBase.ApiCallback): void;
    list(resourceGroupName: string, options: Object, callback: azureServiceClientBase.ApiCallback): void;
    get(resourceGroupName: any, loadBalancerName: any, options: any, callback: any): any;
    createOrUpdate(resourceGroupName: any, loadBalancerName: any, parameters: any, options?: any, callback?: any): any;
}
export declare class publicIPAddresses {
    private client;
    constructor(client: any);
    list(resourceGroupName: any, options?: any, callback?: any): any;
}
export declare class networkSecurityGroups {
    private client;
    constructor(client: any);
    list(resourceGroupName: any, options?: any, callback?: any): any;
}
export declare class NetworkInterfaces {
    private client;
    constructor(client: any);
    list(resourceGroupName: any, options?: any, callback?: any): any;
    createOrUpdate(resourceGroupName: any, networkInterfaceName: any, parameters: any, options: any, callback: any): any;
}
export declare class securityRules {
    private client;
    constructor(client: any);
    get(resourceGroupName: any, networkSecurityGroupName: any, securityRuleName: any, options?: any, callback?: any): any;
    createOrUpdate(resourceGroupName: any, networkSecurityGroupName: any, securityRuleName: any, securityRuleParameters: any, callback: any): any;
}
