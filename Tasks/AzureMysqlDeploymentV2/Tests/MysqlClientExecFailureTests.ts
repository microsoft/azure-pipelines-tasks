import type { TaskResult } from 'azure-pipelines-task-lib/task';
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as path from 'path';

// Drives MysqlClientExecFailureL0Tests.js (the exec-based execution path, used for
// InlineSqlTask/database-creation) under both the hardened (default) and FF-on
// (rollback) feature-flag states, proving a non-zero mysql exit code surfaces as a
// failure on both the hardened and legacy helpers. Called twice by L0.ts - once per
// state, each a fresh, independently spawned process - with
// DISTRIBUTEDTASK_TASKS_ROLLBACKAZUREMYSQLDEPLOYMENTV2BINARYMODEHARDENING set in the
// parent's environment beforehand, which this process inherits.
export class MysqlClientExecFailureTests {

    public static async startTests(): Promise<void> {
        const HARDENING_FEATURE_ENV_VAR = 'DISTRIBUTEDTASK_TASKS_ROLLBACKAZUREMYSQLDEPLOYMENTV2BINARYMODEHARDENING';
        const isRollback = process.env[HARDENING_FEATURE_ENV_VAR] === 'true';

        const tr = new TaskMockRunner(path.join(__dirname, 'MysqlClientExecFailureL0Tests.js'));

        tr.setInput('ConnectedServiceName', 'DEMO_CONNECTED_SERVICE_NAME');
        tr.setInput('ServerName', 'MOCK_SERVER_NAME');
        tr.setInput('SqlUsername', 'DEMO_SQL_USERNAME');
        tr.setInput('SqlPassword', 'DEMO_SQL_PASSWORD');
        tr.setInput('TaskNameSelector', 'InlineSqlTask');
        tr.setInput('SqlInline', 'SELECT 1;');

        const tl = await import('azure-pipelines-task-lib/task');
        // Explicitly mock the rollback flag (rather than leaving it unset) so each run
        // demonstrates its intended path even if the environment happens to define the
        // feature-flag variable, and so a future accidental default flip is caught here.
        tr.registerMockExport('getPipelineFeature', (_featureName: string) => isRollback);
        tr.registerMockExport('exec', async () => 2);
        tr.registerMockExport('setResult', (result: TaskResult, message: string) => {
            tl.setResult(result, message);
        });
        tr.run();
    }
}

MysqlClientExecFailureTests.startTests().catch((error: Error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
});
