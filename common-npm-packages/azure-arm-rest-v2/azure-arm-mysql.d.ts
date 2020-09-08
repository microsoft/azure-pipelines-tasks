import msRestAzure = require("./azure-arm-common");
import azureServiceClient = require("./AzureServiceClient");
import azureServiceClientBase = require("./AzureServiceClientBase");
export declare class AzureMysqlManagementClient extends azureServiceClient.ServiceClient {
    firewallRules: FirewallRules;
    mysqlServers: MysqlServers;
    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: any, baseUri?: any, options?: any);
}
export declare class FirewallRules {
    private client;
    constructor(client: any);
    /**
     * Create or update firewall rule for mysql server
     * @param resourceGroupName     resource group name of mysql server
     * @param serverName            mysql server name
     * @param firewallRuleName      rule name to be added or updated
     * @param parameters            optional parameter like start and end ip address
     * @param callback              response callback
     */
    createOrUpdate(resourceGroupName: string, serverName: string, firewallRuleName: string, parameters: any, callback?: azureServiceClientBase.ApiCallback): void;
    /**
     * Delete firewall rule of mysql server
     * @param resourceGroupName     resource group name of mysql server
     * @param serverName            mysql server name
     * @param firewallRuleName      firewall rule name to be deleted
     * @param callback              response callback
     */
    delete(resourceGroupName: string, serverName: string, firewallRuleName: string, callback?: azureServiceClientBase.ApiCallback): void;
    /**
     * Get firewall rule of mysql server
     * @param resourceGroupName     resource group name of mysql server
     * @param serverName            mysql server name
     * @param firewallRuleName      firewall rule name to be deleted
     * @param callback              response callback
     */
    get(resourceGroupName: string, serverName: string, firewallRuleName: string, callback?: azureServiceClientBase.ApiCallback): void;
    /**
     * Retry get call to check firewall rule has added or not
     * @param resourceGroupName     resource group name of mysql server
     * @param serverName            mysql server name
     * @param firewallRuleName      firewall rule name to be deleted
     * @param retryOption           no of time to retry
     */
    private _recursiveGetCall(resourceGroupName, serverName, firewallRuleName, retryOption, timeToWait);
}
export declare class MysqlServers {
    private client;
    constructor(client: any);
    /**
     * Get all the mysql server belongs to one subscription
     * @param callback  Response callback
     */
    list(callback?: azureServiceClientBase.ApiCallback): void;
}
