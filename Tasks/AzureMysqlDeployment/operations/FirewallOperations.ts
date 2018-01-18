import tl = require('vsts-task-lib/task');
import { ApplicationTokenCredentials} from 'azure-arm-rest/azure-arm-common';
import { AzureMysqlManagementClient } from 'azure-arm-rest/azure-arm-mysql';
import { FirewallRule, FirewallAddressRange } from '../models/Firewall';
import { AzureMysqlTaskParameter } from '../models/AzureMysqlTaskParameter';
import { FirewallConfigurationCheckResult } from '../sql/FirewallConfigurationCheckResult';
import { ISqlClient } from '../sql/ISqlClient';
var uuidV4 = require('uuid/v4');

export class FirewallOperations{

    private _azureMysqManagementClient: AzureMysqlManagementClient;
    private _firewallName: string;

    constructor(azureCredentials: ApplicationTokenCredentials, subscriptionId: string) {
        this._azureMysqManagementClient = new AzureMysqlManagementClient(azureCredentials, subscriptionId);
    }

    public async addFirewallRule(serverName: string, firewallRule: FirewallRule, resourceGroupName: string): Promise<boolean> {
        let defer = Q.defer<boolean>();
        this._azureMysqManagementClient.firewallRules.createOrUpdate(resourceGroupName, serverName, firewallRule.getName(), firewallRule, (error, result, request, response) => {
            if(error){
                throw new Error(tl.loc("NotAbleToConfigureFirewallRule"));
            }else{
                defer.resolve(true);
            }
        });
        return defer.promise;
    }

    public async deleteFirewallRule(serverName: string, resourceGroupName: string): Promise<void> {
        let defer = Q.defer<void>();
        this._azureMysqManagementClient.firewallRules.delete(resourceGroupName, serverName, this._firewallName, (error, result, request, response) => {
            if(error){
                throw new Error(tl.loc("NotAbleToDeleteFirewallRule"));
            }else{
                defer.resolve();
            }
        });
        return defer.promise;
    }

    public async invokeFirewallOperations(azureMysqlTaskParameter: AzureMysqlTaskParameter, sqlClient: ISqlClient, resourceGroupName: string) : Promise<boolean> {
        var defer = Q.defer<boolean>();
        const firewallConfigurationCheckResult: FirewallConfigurationCheckResult = await sqlClient.getFirewallConfiguration();
        if(!firewallConfigurationCheckResult.isIPAdressAlreadyAdded()){
            this._firewallName = "AutoDetect" + uuidV4();
            const firewallAddressRange: FirewallAddressRange = new FirewallAddressRange(firewallConfigurationCheckResult.getIpAddress(), firewallConfigurationCheckResult.getIpAddress());
            const firewallRule: FirewallRule = new FirewallRule(this._firewallName, firewallAddressRange);
            this.addFirewallRule(azureMysqlTaskParameter.getServerName(), firewallRule, resourceGroupName);
            defer.resolve(true);
        }else{
            defer.resolve(false);
        }
        return defer.promise;
    }
}