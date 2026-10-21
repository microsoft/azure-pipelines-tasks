import * as tl from 'azure-pipelines-task-lib/task';
import { MysqlClient } from '../sql/MysqlClient';
import { AzureMysqlTaskParameter } from '../models/AzureMysqlTaskParameter';

// Shared by MysqlClientHardenedExecFailureTests.ts and MysqlClientRollbackExecFailureTests.ts:
// the exec-based execution path behaves identically on both the hardened and legacy
// (FF-on rollback) helpers when mysql exits non-zero, so a single run function covers both, with the
// caller's registered 'getPipelineFeature' mock selecting which code path runs.
async function run(): Promise<void> {
    const parameters = new AzureMysqlTaskParameter();
    const client = new MysqlClient(parameters, 'DEMO_MYSQL_SERVER', '/usr/local/bin/mysql');
    try {
        await client.executeSqlCommand();
        tl.setResult(tl.TaskResult.Failed, 'execNonZeroExit: should have thrown.');
    } catch (error) {
        tl.setResult(tl.TaskResult.Succeeded, 'execNonZeroExit passed.');
    }
}

run();
