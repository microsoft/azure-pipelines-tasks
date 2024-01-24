import tl = require('azure-pipelines-task-lib');
import { ISqlClient } from '../sql/ISqlClient';
import { MysqlClient } from '../sql/MysqlClient';
import { MysqlTaskParameter } from '../models/MysqlTaskParameter';

export class MysqlClientL0Tests  {

    public static mysqlTaskParameter: MysqlTaskParameter = new MysqlTaskParameter();
    public static sqlClient: ISqlClient = new  MysqlClient(MysqlClientL0Tests.mysqlTaskParameter, "/usr/local/bin/mysql");

    public static async startL0Tests() {
        await MysqlClientL0Tests.executeSqlCommand();
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
