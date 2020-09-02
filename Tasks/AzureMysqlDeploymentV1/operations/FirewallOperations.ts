import task = require('azure-pipelines-task-lib/task');
import { ApplicationTokenCredentials} from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-common';
import { AzureMysqlManagementClient } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-mysql';
import { FirewallRule, FirewallAddressRange } from '../models/Firewall';
import { MysqlServer } from '../models/MysqlServer';
import { AzureMysqlTaskParameter } from '../models/AzureMysqlTaskParameter';
import { FirewallConfiguration } from '../models/FirewallConfiguration';
import { ISqlClient } from '../sql/ISqlClient';
import Q = require('q');

export class FirewallOperations {

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
    public async addFirewallRule(serverName: string, firewallRule: FirewallRule, resourceGroupName: string): Promise<void> {
        let defer = Q.defer<void>();
        this._azureMysqManagementClient.firewallRules.createOrUpdate(resourceGroupName, serverName, firewallRule.getName(), firewallRule, (error, result, request, response) => {
            if(error){
                task.debug("Getting error during adding firewall rule: "+ error);
                defer.reject(new Error(task.loc("NotAbleToAddFirewallRule", error)));
            }else{
                defer.resolve();
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
                task.debug("Getting error during deleting firewall rule: "+ error);
                defer.reject(new Error(task.loc("NotAbleToDeleteFirewallRule", error)));
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
    public async invokeFirewallOperations(azureMysqlTaskParameter: AzureMysqlTaskParameter, sqlClient: ISqlClient, mysqlServer: MysqlServer) : Promise<boolean> {
        var defer = Q.defer<boolean>();
        if(azureMysqlTaskParameter.getIpDetectionMethod() ==='IPAddressRange'){
            this._preparefirewallRule(mysqlServer.getName(), azureMysqlTaskParameter.getStartIpAddress(), azureMysqlTaskParameter.getEndIpAddress(), mysqlServer.getResourceGroupName(), "IPAddressRange_" + this._getFirewallRuleName()).then(() =>{
                let firewallConfiguration: FirewallConfiguration = sqlClient.getFirewallConfiguration();
                console.log(" firewall conf " +JSON.stringify(firewallConfiguration));

                if(!firewallConfiguration.isIpAdressAlreadyAdded()){
                    task.debug("Agent Ip address not in added firewall rule: "+ firewallConfiguration.getIpAddress());
                    defer.reject(new Error(task.loc("AgentIpAddressIsMissingInAddedFirewallRule")));
                }else{
                    defer.resolve(true);
                }
            },(error) =>{
                task.debug("Error during adding firewall rule for IPAddressRange: "+ error);
                defer.reject(error);
            });
        }else {
            const firewallConfiguration: FirewallConfiguration = sqlClient.getFirewallConfiguration();
            if(!firewallConfiguration.isIpAdressAlreadyAdded()){
                this._preparefirewallRule(mysqlServer.getName(), firewallConfiguration.getIpAddress(), firewallConfiguration.getIpAddress(), mysqlServer.getResourceGroupName(), "AutoDetect_" + this._getFirewallRuleName()).then(() =>{
                    defer.resolve(true);
                },(error) =>{
                    task.debug("Error during adding firewall rule for IPAddressRange: "+ error);
                    defer.reject(error);
                });
            }else{
                defer.resolve(false);
            }
        }
        return defer.promise;
    }

    /**
     * Prepare firewall rule for mysql server
     */
    private async _preparefirewallRule(serverName: string, startIpAddress: string, endIpAddress: string, resourceGroupName: string, ruleName: string): Promise<void> {
        var defer = Q.defer<void>();
        this._firewallName = ruleName;
        const firewallAddressRange: FirewallAddressRange = new FirewallAddressRange(startIpAddress, endIpAddress);
        const firewallRule: FirewallRule = new FirewallRule(this._firewallName, firewallAddressRange);
        this.addFirewallRule(serverName, firewallRule, resourceGroupName).then(() =>{
                task.debug('Firewall configuration name added : ' + this._firewallName);
                defer.resolve();
            },(error) => {
                defer.reject(error)
            });
        return defer.promise;
    }

    private _getFirewallRuleName(): string {
        let buildId = task.getVariable('build.buildId');
        let releaseId = task.getVariable('release.releaseId');
        let firewallRuleName: string = (releaseId ? releaseId : buildId) + Date.now().toString();
        return firewallRuleName;
    }
}
