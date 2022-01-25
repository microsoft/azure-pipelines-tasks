import task = require('azure-pipelines-task-lib/task');
import Q = require('q');
import path = require('path');
import { MysqlTaskParameter } from './models/MysqlTaskParameter';
import { ToolPathOperations } from './operations/ToolPathOperations';
import { ISqlClient } from './sql/ISqlClient';
import { MysqlClient } from './sql/MysqlClient';

async function run() {
    let mysqlTaskParameter: MysqlTaskParameter;
    try {
        task.debug('Task execution started');
        task.setResourcePath(path.join( __dirname, 'task.json'));
        task.setResourcePath(path.join( __dirname, 'node_modules/azure-pipelines-tasks-webdeployment-common-v4/module.json'));
        // Get all task input parameters
        mysqlTaskParameter = new MysqlTaskParameter();
        task.debug('parsed task inputs');
        const mysqlClientPath: string = await new ToolPathOperations().getInstalledPathOfMysql();
        if(mysqlClientPath) {
             // Mysql client
            const sqlClient: ISqlClient = new  MysqlClient(mysqlTaskParameter, mysqlClientPath);
            //Execute sql script entered by user
            await sqlClient.executeSqlCommand();
        }
        else {
            throw new Error(task.loc("NotAbleToGetInstalledLocationOfMysqlFromPath"));
        }
    }
    catch(exception) {
        task.debug('Getting exception: '+exception);
        task.setResult(task.TaskResult.Failed, exception);
    }

    task.debug('Task completed.');
}

run();
