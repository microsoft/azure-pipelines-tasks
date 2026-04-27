import task = require('azure-pipelines-task-lib/task');
import { ApplicationTokenCredentials} from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-common';
import { AzureMysqlFlexibleServerManagementClient } from '../azure-arm-mysql-flexible';
import { FirewallRule, FirewallAddressRange } from '../models/Firewall';
import { MysqlServer } from '../models/MysqlServer';
import { AzureMysqlTaskParameter } from '../models/AzureMysqlTaskParameter';
import { FirewallConfiguration } from '../models/FirewallConfiguration';
import { ISqlClient } from '../sql/ISqlClient';

export class FirewallOperations {

    private _azureMysqManagementClient: AzureMysqlFlexibleServerManagementClient;
    private _firewallName: string;

    constructor(azureCredentials: ApplicationTokenCredentials, subscriptionId: string) {
        this._azureMysqManagementClient = new AzureMysqlFlexibleServerManagementClient(azureCredentials, subscriptionId);
    }

    /**
     * Add firewall rule for particular mysql flexible server
     * @param serverName          mysql server name
     * @param firewallRule        firewallRule i.e name and Ip Adress range
     * @param resourceGroupName   mysql server resource group name
     * 
     * @returns operation is success or failure
     */
    public addFirewallRule(serverName: string, firewallRule: FirewallRule, resourceGroupName: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._azureMysqManagementClient.firewallRules.createOrUpdate(resourceGroupName, serverName, firewallRule.getName(), firewallRule, (error, result, request, response) => {
                if(error){
                    task.debug("Getting error during adding firewall rule: "+ error);
                    reject(new Error(task.loc("NotAbleToAddFirewallRule", error)));
                }else{
                    resolve();
                }
            });
        });
    }

    /**
     * Delete firewall rule for mysql flexible server 
     * @param serverName           mysql server name
     * @param resourceGroupName    mysql server resource group name
     * 
     * @returns operation is success or failure
     */
    public deleteFirewallRule(serverName: string, resourceGroupName: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._azureMysqManagementClient.firewallRules.delete(resourceGroupName, serverName, this._firewallName, (error, result, request, response) => {
                if(error){
                    task.debug("Getting error during deleting firewall rule: "+ error);
                    reject(new Error(task.loc("NotAbleToDeleteFirewallRule", error)));
                }else{
                    resolve();
                }
            });
        });
    }

    /**
     * To check agent box has permission to connect with mysqlServer or not. If not then add firewall rule to whitelist this IP.
     * @param azureMysqlTaskParameter    task input parameters
     * @param sqlClient                  mysql client
     * @param resourceGroupName          mysql server resource group name
     * 
     * @returns                          firewall rule added or not 
     */
    public async invokeFirewallOperations(azureMysqlTaskParameter: AzureMysqlTaskParameter, sqlClient: ISqlClient, mysqlServer: MysqlServer) : Promise<boolean> {
        if(azureMysqlTaskParameter.getIpDetectionMethod() ==='IPAddressRange'){
            await this._preparefirewallRule(mysqlServer.getName(), azureMysqlTaskParameter.getStartIpAddress(), azureMysqlTaskParameter.getEndIpAddress(), mysqlServer.getResourceGroupName(), "IPAddressRange_" + this._getFirewallRuleName());
            const firewallConfiguration: FirewallConfiguration = sqlClient.getFirewallConfiguration();
            task.debug(" firewall conf " +JSON.stringify(firewallConfiguration));

            if(!firewallConfiguration.isIpAdressAlreadyAdded()){
                task.debug("Agent Ip address not in added firewall rule: "+ firewallConfiguration.getIpAddress());
                throw new Error(task.loc("AgentIpAddressIsMissingInAddedFirewallRule"));
            }
            return true;
        }else {
            const firewallConfiguration: FirewallConfiguration = sqlClient.getFirewallConfiguration();
            if(!firewallConfiguration.isIpAdressAlreadyAdded()){
                await this._preparefirewallRule(mysqlServer.getName(), firewallConfiguration.getIpAddress(), firewallConfiguration.getIpAddress(), mysqlServer.getResourceGroupName(), "AutoDetect_" + this._getFirewallRuleName());
                return true;
            }
            return false;
        }
    }

    /**
     * Prepare firewall rule for mysql flexible server
     */
    private async _preparefirewallRule(serverName: string, startIpAddress: string, endIpAddress: string, resourceGroupName: string, ruleName: string): Promise<void> {
        this._firewallName = ruleName;
        const firewallAddressRange: FirewallAddressRange = new FirewallAddressRange(startIpAddress, endIpAddress);
        const firewallRule: FirewallRule = new FirewallRule(this._firewallName, firewallAddressRange);
        await this.addFirewallRule(serverName, firewallRule, resourceGroupName);
        task.debug('Firewall configuration name added : ' + this._firewallName);
    }

    private _getFirewallRuleName(): string {
        let buildId = task.getVariable('build.buildId');
        let releaseId = task.getVariable('release.releaseId');
        let firewallRuleName: string = (releaseId ? releaseId : buildId) + "_" + Date.now().toString();
        return firewallRuleName;
    }
}
