import tl = require('vsts-task-lib/task');
import Q = require('q');
import path = require('path');
import { FirewallRule, FirewallAddressRange } from './models/Firewall';
import { MysqlServer } from './models/MysqlServer';
import { AzureMysqlTaskParameter } from './models/AzureMysqlTaskParameter';
import { FirewallOperations } from './operations/FirewallOperations';
import { MysqlServerOperations } from './operations/MysqlServerOperations';
import { ToolPathOperations } from './operations/ToolPathOperations';
import { FirewallConfigurationCheckResult } from './sql/FirewallConfigurationCheckResult';
import { ISqlClient } from './sql/ISqlClient';
import { MysqlClient } from './sql/MysqlClient';
import { AzureRMEndpoint } from 'azure-arm-rest/azure-arm-endpoint';
import { AzureEndpoint } from 'azure-arm-rest/azureModels';
import { ApplicationTokenCredentials } from 'azure-arm-rest/azure-arm-common';

async function run() {
    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));

        // Get all task input parameter
        const azureMysqlTaskParameter: AzureMysqlTaskParameter = new AzureMysqlTaskParameter();
        const endpoint: AzureEndpoint = await new AzureRMEndpoint(azureMysqlTaskParameter.getConnectedServiceName()).getEndpoint();
        if(!endpoint){
            throw new Error(tl.loc("AzureEndpointCannotBeNull"));
        }       
        const azureCredentails = new ApplicationTokenCredentials(endpoint.servicePrincipalClientID,endpoint.tenantID, endpoint.servicePrincipalKey, 
            endpoint.url, endpoint.environmentAuthorityUrl, endpoint.activeDirectoryResourceID, endpoint.environment.toLowerCase() == 'azurestack');
        const mysqlServerOperations: MysqlServerOperations = new MysqlServerOperations(azureCredentails, endpoint.subscriptionID);
        // Get mysql server data entered by user 
        const mysqlServer: MysqlServer = await mysqlServerOperations.getMysqlServerFromServerName(azureMysqlTaskParameter.getServerName());
        const toolPath: string = await new ToolPathOperations().getInstalledPathOfMysql();
        // Mysql client
        const sqlClient: ISqlClient = new  MysqlClient(azureMysqlTaskParameter, mysqlServer.getFullyQualifiedName(), toolPath);
        const firewallOperations : FirewallOperations = new FirewallOperations(azureCredentails, endpoint.subscriptionID);
        //Invoke firewall operation to validate user has permission for server or not. If not whitelist the IP
        const firewallAdded: boolean = await firewallOperations.invokeFirewallOperations(azureMysqlTaskParameter, sqlClient, mysqlServer.getResourceGroupName());
        //Execute sql script entered by user
        await sqlClient.executeSqlCommand();
        // Delete firewall rule in case of automatic added rule or either user wants to delete it
        if(firewallAdded || azureMysqlTaskParameter.getDeleteFirewallRule()){
            await firewallOperations.deleteFirewallRule(mysqlServer.getName(), mysqlServer.getResourceGroupName());
        }
    }
    catch(exception) {
        tl.setResult(tl.TaskResult.Failed, exception);
    }
    tl.setResult(tl.TaskResult.Succeeded, "Task is Sucessfully completed");
    tl.debug('Completed action');
}

run();