import * as tl from 'azure-pipelines-task-lib/task';
import { MysqlClient } from '../sql/MysqlClient';
import { AzureMysqlTaskParameter } from '../models/AzureMysqlTaskParameter';

async function run(): Promise<void> {
    const parameters = new AzureMysqlTaskParameter();
    const client = new MysqlClient(parameters, 'DEMO_MYSQL_SERVER', '/usr/local/bin/mysql');
    try {
        await client.executeSqlCommand();
        tl.setResult(tl.TaskResult.Failed, 'hardenedExecNonZeroExit: should have thrown.');
    } catch (error) {
        tl.setResult(tl.TaskResult.Succeeded, 'hardenedExecNonZeroExit passed.');
    }
}

run();
