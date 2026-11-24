import * as assert from 'assert';
import type { TaskResult } from 'azure-pipelines-task-lib/task';
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as path from 'path';

// Parameterized by two env vars (set by Tests/L0.ts before spawning each
// variant) so the same driver covers all four combinations the task
// supports: {InlineSqlTask, SqlTaskFile} x {DatabaseName set, DatabaseName unset}.
const SELECTOR_ENV_VAR = 'MYSQL_MACHINEGROUP_TEST_SELECTOR';
const WITH_DB_ENV_VAR = 'MYSQL_MACHINEGROUP_TEST_WITHDB';

export class MysqlClientExecTests {
    public static async startTests(): Promise<void> {
        const selector = process.env[SELECTOR_ENV_VAR] || 'InlineSqlTask';
        const withDatabase = process.env[WITH_DB_ENV_VAR] === 'true';

        const tr = new TaskMockRunner(path.join(__dirname, 'MysqlClientExecL0Tests.js'));
        const sqlFilePath = 'C:\\path\\script.sql';
        const sqlInline = 'SELECT 1;';
        const databaseName = withDatabase ? 'testdb' : '';

        tr.setInput('ServerName', 'HOST');
        tr.setInput('SqlUsername', 'USER');
        tr.setInput('SqlPassword', 'PASS');
        tr.setInput('TaskNameSelector', selector);
        tr.setInput('SqlInline', sqlInline);
        tr.setInput('SqlFile', sqlFilePath);
        tr.setInput('DatabaseName', databaseName);
        tr.setInput('SqlAdditionalArguments', '');

        const connectionArgs = ['-hHOST', '-uUSER', '-pPASS'];
        const createDatabaseArgs = [...connectionArgs, '-eCREATE DATABASE IF NOT EXISTS `testdb` ;'];
        const scriptArgs = selector === 'InlineSqlTask'
            ? [...connectionArgs, ...(withDatabase ? ['-Dtestdb'] : []), '-e' + sqlInline]
            : [...connectionArgs, ...(withDatabase ? ['-Dtestdb'] : []), '-e source ' + sqlFilePath];        const expectedExecutions = withDatabase ? [createDatabaseArgs, scriptArgs] : [scriptArgs];
        let executionCount = 0;

        const tl = await import('azure-pipelines-task-lib/task');
        tr.registerMockExport('exec', async (tool: string, args: string[], options?: unknown) => {
            assert.strictEqual(tool, '/usr/local/bin/mysql');
            assert.deepStrictEqual(args, expectedExecutions[executionCount], `Unexpected mysql invocation ${executionCount}.`);
            assert.deepStrictEqual(options, { externalOutput: { source: 'childProcess' } },
                'Every mysql invocation must filter untrusted output through the external-output marker filter.');
            executionCount++;
            return 0;
        });
        tr.registerMockExport('setResult', (result: TaskResult, message: string) => {
            if (result === tl.TaskResult.Succeeded) {
                assert.strictEqual(executionCount, expectedExecutions.length, 'Every expected mysql invocation must run.');
            }
            tl.setResult(result, message);
        });
        tr.registerMock('azure-pipelines-tasks-webdeployment-common/packageUtility.js', {
            PackageUtility: {
                getPackagePath: (filePath: string) => filePath
            }
        });

        tr.run();
    }
}

MysqlClientExecTests.startTests().catch((error: Error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
});
