import tl = require('vsts-task-lib/task');
import msRestAzure = require('azure-arm-rest/azure-arm-common');
import { AzureMysqManagementClient } from 'azure-arm-rest/azure-arm-mysql';
import { AzureMysqlTaskParameter } from '../models/AzureMysqlTaskParameter';
import { FirewallRule , FirewallAddressRange } from '../models/Firewall';
import { FirewallConfigurationCheckResult } from '../sql/FirewallConfigurationCheckResult';
import { ISqlClient } from '../sql/ISqlClient';
import { AzureEndpoint } from 'azure-arm-rest/azureModels';
import { endianness } from 'os';

export class FirewallOperations{

    private _azureMysqManagementClient: AzureMysqManagementClient;
    private _azureMysqlTaskParameter: AzureMysqlTaskParameter;

    constructor(azureMysqlTaskParameter: AzureMysqlTaskParameter, endpoint: AzureEndpoint ) {
        this._azureMysqlTaskParameter = azureMysqlTaskParameter;
        this._azureMysqManagementClient = new AzureMysqManagementClient(this._getAzureCredentials(endpoint), endpoint.subscriptionID);
    }

    public addFirewallRule(firewallRule: FirewallRule){
        this._azureMysqManagementClient.firewallRules.createOrUpdate(this._azureMysqlTaskParameter.getResourceGroupName(), this._azureMysqlTaskParameter.getServerName(), firewallRule.getName(), firewallRule.getFirewallAddressRange(), (error, result, request, response) => {
            if(error){
                throw new Error(tl.loc("NotAbleToConfigureFirewallRule"));
            }
        });
    }

    public deleteFirewallRule(ruleName: string): void{
        this._azureMysqManagementClient.firewallRules.delete(this._azureMysqlTaskParameter.getResourceGroupName(), this._azureMysqlTaskParameter.getServerName(), ruleName, (error, result, request, response) => {
            if(error){
                throw new Error(tl.loc("NotAbleToDeleteFirewallRule"));
            }
        });
    }

    private _getAzureCredentials(endpoint: AzureEndpoint): msRestAzure.ApplicationTokenCredentials {
        if(!endpoint){
            throw new Error(tl.loc("AzureEndpointCannotBeNull"));
        }
        let credentials: msRestAzure.ApplicationTokenCredentials = new msRestAzure.ApplicationTokenCredentials(endpoint.servicePrincipalClientID, endpoint.tenantID, endpoint.servicePrincipalKey, 
            endpoint.url, endpoint.environmentAuthorityUrl, endpoint.activeDirectoryResourceID, endpoint.environment.toLowerCase() == 'azurestack');
        return credentials;
    }

}