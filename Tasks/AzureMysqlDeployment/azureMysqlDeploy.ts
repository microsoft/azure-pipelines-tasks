import task = require('vsts-task-lib/task');
import Q = require('q');
import path = require('path');
import { FirewallRule, FirewallAddressRange } from './models/Firewall';
import { MysqlServer } from './models/MysqlServer';
import { AzureMysqlTaskParameter } from './models/AzureMysqlTaskParameter';
import { FirewallOperations } from './operations/FirewallOperations';
import { MysqlServerOperations } from './operations/MysqlServerOperations';
import { ToolPathOperations } from './operations/ToolPathOperations';
import { ISqlClient } from './sql/ISqlClient';
import { MysqlClient } from './sql/MysqlClient';
import { AzureRMEndpoint } from 'azure-arm-rest/azure-arm-endpoint';
import { AzureEndpoint } from 'azure-arm-rest/azureModels';
import { ApplicationTokenCredentials } from 'azure-arm-rest/azure-arm-common';

async function run() {
    let azureMysqlTaskParameter: AzureMysqlTaskParameter;
    let firewallAdded: boolean;
    try {
        task.debug('Task execution started');
        task.setResourcePath(path.join( __dirname, 'task.json'));
        // Get all task input parameters
        azureMysqlTaskParameter = new AzureMysqlTaskParameter();
        task.debug('parsed task inputs');
        const endpoint: AzureEndpoint = await new AzureRMEndpoint(azureMysqlTaskParameter.getConnectedServiceName()).getEndpoint();
        if(!endpoint){
            task.debug('Azure Endpoint is null');
            throw new Error(task.loc("AzureEndpointCannotBeNull"));
        }       
        const mysqlServerOperations: MysqlServerOperations = new MysqlServerOperations(endpoint.applicationTokenCredentials, endpoint.subscriptionID);
        // Get mysql server data entered by user 
        const mysqlServer: MysqlServer = await mysqlServerOperations.getMysqlServerFromServerName(azureMysqlTaskParameter.getServerName());
        task.debug('Mysql server details from server name: '+JSON.stringify(mysqlServer));
        const mysqlClientPath: string = await new ToolPathOperations().getInstalledPathOfMysql();
        if(mysqlClientPath){
             // Mysql client
            const sqlClient: ISqlClient = new  MysqlClient(azureMysqlTaskParameter, mysqlServer.getFullyQualifiedName(), mysqlClientPath);
            const firewallOperations : FirewallOperations = new FirewallOperations(endpoint.applicationTokenCredentials, endpoint.subscriptionID);
            //Invoke firewall operation to validate user has permission for server or not. If not whitelist the IP
            firewallAdded = await firewallOperations.invokeFirewallOperations(azureMysqlTaskParameter, sqlClient, mysqlServer.getResourceGroupName());
            //Execute sql script entered by user
            await sqlClient.executeSqlCommand();
        }else{
            throw new Error(task.loc("NotAbleToGetInstalledLocationOfMysqlFromPath"));
        }
    }
    catch(exception) {
        task.debug('Getting exception: '+exception);
        task.setResult(task.TaskResult.Failed, exception);
    }
    finally{
        // Delete firewall rule in case of automatic added rule or either user wants to delete it
        if(firewallAdded && azureMysqlTaskParameter && azureMysqlTaskParameter.getDeleteFirewallRule()){
            task.debug('Deleting firewall rule');
            await firewallOperations.deleteFirewallRule(mysqlServer.getName(), mysqlServer.getResourceGroupName());
            task.debug('Sucessfully deleted firewall rule');
        }
    }

    task.debug('Task completed sucessfully.');
    task.setResult(task.TaskResult.Succeeded, "Task is Sucessfully completed");
}

run();
