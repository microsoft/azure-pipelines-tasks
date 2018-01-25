import tl = require('vsts-task-lib/task');
import { ApplicationTokenCredentials} from 'azure-arm-rest/azure-arm-common';
import { AzureMysqlManagementClient } from 'azure-arm-rest/azure-arm-mysql';
import { FirewallRule, FirewallAddressRange } from '../models/Firewall';
import { AzureMysqlTaskParameter } from '../models/AzureMysqlTaskParameter';
import { FirewallConfigurationCheckResult } from '../models/FirewallConfigurationCheckResult';
import { ISqlClient } from '../sql/ISqlClient';
import Q = require('q');
var uuidV4 = require('uuid/v4');

export class FirewallOperations{

    private _azureMysqManagementClient: AzureMysqlManagementClient;
    private _firewallName: string;

    constructor(azureCredentials: ApplicationTokenCredentials, subscriptionId: string) {
        this._azureMysqManagementClient = new AzureMysqlManagementClient(azureCredentials, subscriptionId);
    }

    /**
     * Add firewall rule for particular mysql server
     * @param serverName          mysql server name
     * @param firewallRule        firewallRule i.e name and Ip Adress range
     * @param resourceGroupName   mysql server resource group name
     * 
     * @returns operation is success or failure
     */
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

    /**
     * Delete firewall rule for mysql server 
     * @param serverName           mysql server name
     * @param resourceGroupName    mysql server resource group name
     * 
     * @returns operation is success or failure
     */
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

    /**
     * To check agent box has permission to connect with mysqlServer or not. If not then add firewall rule to whitelist this IP.
     * @param azureMysqlTaskParameter    task input parameters
     * @param sqlClient                  mysql client
     * @param resourceGroupName          mysql server resource group name
     * 
     * @returns                          firewall rule added or not 
     */
    public async invokeFirewallOperations(azureMysqlTaskParameter: AzureMysqlTaskParameter, sqlClient: ISqlClient, resourceGroupName: string) : Promise<boolean> {
        var defer = Q.defer<boolean>();
        const firewallConfigurationCheckResult: FirewallConfigurationCheckResult = await sqlClient.getFirewallConfiguration();
        if( azureMysqlTaskParameter.getIpDetectionMethod() ==='AutoDetect' && !firewallConfigurationCheckResult.isIpAdressAlreadyAdded()){
            this._firewallName = "AutoDetect" + uuidV4();
            const firewallAddressRange: FirewallAddressRange = new FirewallAddressRange(firewallConfigurationCheckResult.getIpAddress(), firewallConfigurationCheckResult.getIpAddress());
            const firewallRule: FirewallRule = new FirewallRule(this._firewallName, firewallAddressRange);
            await this.addFirewallRule(azureMysqlTaskParameter.getServerName(), firewallRule, resourceGroupName);
            defer.resolve(true);
        }else if(azureMysqlTaskParameter.getIpDetectionMethod() ==='IPAddressRange'){
            this._firewallName = "IPAddressRange" + uuidV4();
            const firewallAddressRange: FirewallAddressRange = new FirewallAddressRange(azureMysqlTaskParameter.getStartIpAddress(), azureMysqlTaskParameter.getEndIpAddress());
            const firewallRule: FirewallRule = new FirewallRule(this._firewallName, firewallAddressRange);
            await this.addFirewallRule(azureMysqlTaskParameter.getServerName(), firewallRule, resourceGroupName);
            defer.resolve(true);
        }else{
            defer.resolve(false);
        }

        return defer.promise;
    }
}
