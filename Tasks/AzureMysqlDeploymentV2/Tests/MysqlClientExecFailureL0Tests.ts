import * as assert from 'assert';
import * as tl from 'azure-pipelines-task-lib/task';
import { MysqlClient } from '../sql/MysqlClient';
import { AzureMysqlTaskParameter } from '../models/AzureMysqlTaskParameter';

async function run(): Promise<void> {
    const parameters = new AzureMysqlTaskParameter();
    const client = new MysqlClient(parameters, 'DEMO_MYSQL_SERVER', '/usr/local/bin/mysql');
    await assert.rejects(
        () => client.executeSqlCommand(),
        { name: 'Error', message: tl.loc('SqlExecutionException', 2) }
    );
    tl.setResult(tl.TaskResult.Succeeded, 'execNonZeroExit passed.');
}

run().catch((error: Error) => {
    tl.setResult(tl.TaskResult.Failed, error.stack || error.message);
});
