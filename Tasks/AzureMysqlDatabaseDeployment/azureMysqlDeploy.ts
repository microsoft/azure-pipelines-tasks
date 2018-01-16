import tl = require('vsts-task-lib/task');
import Q = require('q');
import path = require('path');
import { FirewallRule, FirewallAddressRange } from './models/Firewall';
import { AzureMysqlTaskParameter } from './models/AzureMysqlTaskParameter';
import { FirewallOperations } from './operations/FirewallOperations';
import { FirewallConfigurationCheckResult } from './sql/FirewallConfigurationCheckResult';
import { ISqlClient } from './sql/ISqlClient';
import { Mysql2Client } from './sql/Mysql2Client';
import { AzureRMEndpoint } from 'azure-arm-rest/azure-arm-endpoint';
import { AzureEndpoint } from 'azure-arm-rest/azureModels';
var uuidV4 = require('uuid/v4');

const APPLICATION_INSIGHTS_EXTENSION_NAME: string = "Microsoft.ApplicationInsights.AzureWebSites";
const pingApplicationCount: number = 1;
const productionSlot: string = "production";

async function run() {
    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        var taskResult = true;
        var errorMessage: string = "";
        var updateDeploymentStatus: boolean = true;

        let azureMysqlTaskParameter: AzureMysqlTaskParameter = new AzureMysqlTaskParameter();
        let endpoint: AzureEndpoint = await new AzureRMEndpoint(azureMysqlTaskParameter.getConnectedServiceName()).getEndpoint();
        let firewallOperations : FirewallOperations = new FirewallOperations(azureMysqlTaskParameter, endpoint);
        const sqlClient: ISqlClient = new  Mysql2Client(azureMysqlTaskParameter);
        const firewallConfigurationCheckResult: FirewallConfigurationCheckResult = await sqlClient.checkFirewallConfiguraion();
        if(!firewallConfigurationCheckResult.isIPAdressAlreadyAdded()){
                const firewallAddressRange: FirewallAddressRange = new FirewallAddressRange(firewallConfigurationCheckResult.getIpAddress(), firewallConfigurationCheckResult.getIpAddress());
                const firewallRule: FirewallRule = new FirewallRule("AutoDetect "+uuidV4(), firewallAddressRange);
                this.addFirewallRule(firewallRule);
        }

    }
    catch(exception) {
        taskResult = false;
        errorMessage = exception;
    }

    tl.debug('Completed action');

    if (!taskResult) {
        tl.setResult(tl.TaskResult.Failed, errorMessage);
    }
}

run();