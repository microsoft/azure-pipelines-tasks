import tl = require('azure-pipelines-task-lib');
import { ISqlClient } from '../sql/ISqlClient';
import { MysqlClient } from '../sql/MysqlClient';
import { FirewallConfiguration } from '../models/FirewallConfiguration';
import { AzureMysqlTaskParameter } from '../models/AzureMysqlTaskParameter';

export class MysqlClientL0Tests  {

    public static azureMysqlTaskParameter: AzureMysqlTaskParameter = new AzureMysqlTaskParameter();
    public static sqlClient: ISqlClient = new  MysqlClient(MysqlClientL0Tests.azureMysqlTaskParameter, "DEMO_MYSQL_SERVER", "/usr/local/bin/mysql");

    public static async startL0Tests() {
        await MysqlClientL0Tests.getFirewallConfiguration();
        await MysqlClientL0Tests.executeSqlCommand();
    }

    public static async getFirewallConfiguration(){
        try{
            const firewallConfiguration: FirewallConfiguration = await MysqlClientL0Tests.sqlClient.getFirewallConfiguration();
            if(!firewallConfiguration.isIpAdressAlreadyAdded() && firewallConfiguration.getIpAddress() == '250.250.250.250'){
                tl.setResult(tl.TaskResult.Succeeded, 'MysqlClientL0Tests.getFirewallConfiguration should has passed.');
            }else{
                tl.setResult(tl.TaskResult.Failed, 'MysqlClientL0Tests.getFirewallConfiguration should has passed but failed.');  
            }
        }catch(error){
            tl.setResult(tl.TaskResult.Failed, 'MysqlClientL0Tests.getFirewallConfiguration should has passed but failed due to error.');
        }
    }
    
    public static async executeSqlCommand(){
        try{
            const response: number = await MysqlClientL0Tests.sqlClient.executeSqlCommand();
            if(response == 0){
                tl.setResult(tl.TaskResult.Succeeded, 'MysqlClientL0Tests.executeSqlCommand should has passed.');
            }else{
                tl.setResult(tl.TaskResult.Failed, 'MysqlClientL0Tests.executeSqlCommand should has passed but failed.');
            }
        }catch(error){
            tl.setResult(tl.TaskResult.Failed, 'MysqlClientL0Tests.executeSqlCommand should has passed but failed due to error.');
        }
    }

}

MysqlClientL0Tests.startL0Tests();
