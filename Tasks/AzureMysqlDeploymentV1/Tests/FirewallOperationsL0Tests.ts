import { getMockEndpoint, nock, getMockFirewallRules } from './mock_utils';
import * as querystring from 'querystring';
import tl = require('azure-pipelines-task-lib');
import { FirewallOperations } from '../operations/FirewallOperations';
import { FirewallRule, FirewallAddressRange } from '../models/Firewall';
import { AzureMysqlTaskParameter } from '../models/AzureMysqlTaskParameter';
import { MysqlClient } from '../sql/MysqlClient';
import { ISqlClient } from '../sql/ISqlClient';
import { MysqlServer } from '../models/MysqlServer';
var endpoint = getMockEndpoint();
getMockFirewallRules();

export class FirewallOperationsL0Tests  {

    public static firewallOperations: FirewallOperations = new FirewallOperations(endpoint.applicationTokenCredentials, endpoint.subscriptionID);
    public static firewallRule: FirewallRule = new FirewallRule("MOCK_FIREWALL_RULE_NAME", new FirewallAddressRange("0.0.0.0", "255.255.255.255"));

    public static async testFirewallOperations() {
        await FirewallOperationsL0Tests.addFirewallRuleTest();
        await FirewallOperationsL0Tests.deleteFirewallRuleTest();
    }

    public static async addFirewallRuleTest(){
        try{
            const azureMysqlTaskParameter: AzureMysqlTaskParameter = new AzureMysqlTaskParameter();
            const sqlClient: ISqlClient = new  MysqlClient(azureMysqlTaskParameter, "MOCK_SERVER_NAME.test-vm1.onebox.xdb.mscds.com", "MOCK_MYSQL_CLIENT_PATH");
            const mysqlServer: MysqlServer = new MysqlServer("MOCK_SERVER_NAME", "MOCK_SERVER_NAME.test-vm1.onebox.xdb.mscds.com", "MOCK_RESOURCE_GROUP_NAME");
            const response = await FirewallOperationsL0Tests.firewallOperations.invokeFirewallOperations(azureMysqlTaskParameter, sqlClient, mysqlServer);
            if(response){
                tl.setResult(tl.TaskResult.Succeeded, 'FirewallOperationsL0Tests.addFirewallRuleTest should have succeeded.');
            }else{
                tl.setResult(tl.TaskResult.Failed, 'FirewallOperationsL0Tests.addFirewallRuleTest should have succeeded but failed.');
            }
        }catch(error){
            tl.setResult(tl.TaskResult.Failed, 'FirewallOperationsL0Tests.addFirewallRuleTest should have succeeded but failed.');
        }
    }

    public static async deleteFirewallRuleTest(){
        try{
            await FirewallOperationsL0Tests.firewallOperations.deleteFirewallRule("MOCK_SERVER_NAME", "MOCK_RESOURCE_GROUP_NAME");
            tl.setResult(tl.TaskResult.Succeeded, 'FirewallOperationsL0Tests.deleteFirewallRuleTest should have succeeded.');
        }catch(error){
            tl.setResult(tl.TaskResult.Failed, 'FirewallOperationsL0Tests.deleteFirewallRuleTest should have succeeded but failed.');
        }
    }

}

FirewallOperationsL0Tests.testFirewallOperations();
