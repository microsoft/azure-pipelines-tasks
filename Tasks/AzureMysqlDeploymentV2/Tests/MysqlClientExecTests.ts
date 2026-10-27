import * as assert from 'assert';
import type { TaskResult } from 'azure-pipelines-task-lib/task';
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as path from 'path';
import { Readable } from 'stream';

export class MysqlClientExecTests {

    public static async startTests(): Promise<void> {
        const HARDENING_FEATURE_ENV_VAR = 'DISTRIBUTEDTASK_TASKS_ROLLBACKAZUREMYSQLDEPLOYMENTV2BINARYMODEHARDENING';
        const isRollback = process.env[HARDENING_FEATURE_ENV_VAR] === 'true';

        const tr = new TaskMockRunner(path.join(__dirname, 'MysqlClientExecL0Tests.js'));
        const sqlFilePath = path.join(__dirname, isRollback ? 'rollback script.sql' : 'hardened script.sql');
        const sql = 'SELECT "quoted", \'single\', \'C:\\data\\file\';\nSELECT 2;';
        // The legacy (FF-on rollback) path re-tokenizes a single built-up string
        // (Utility.argStringToArray), so the username must not contain spaces - unlike
        // the hardened array-based path, which preserves spaces in any argv element.
        const username = isRollback ? 'DEMO_SQL_USERNAME' : 'DEMO SQL USERNAME';
        const password = isRollback ? 'DEMO_SQL_PASSWORD' : 'DEMO SQL PASSWORD';
        const connectionArgs = isRollback
            ? [
                '-hDEMO_MYSQL_SERVER',
                `-u${username}`,
                `-p${password}`,
                '--ssl-mode=REQUIRED',
                '--quick',
                '--connect-timeout=10'
            ]
            : [
                '-hDEMO_MYSQL_SERVER',
                `-u${username}`,
                `-p${password}`,
                '--ssl-mode=REQUIRED',
                '--binary-mode',
                '--quick',
                '--connect-timeout=10'
            ];
            
        const createDatabaseArgs = isRollback
            ? [...connectionArgs, '-eCREATE DATABASE IF NOT EXISTS `test-db` ;']
            : [...connectionArgs, '-e', 'CREATE DATABASE IF NOT EXISTS `test-db`;'];
        
        const expectedExecutions = [
            createDatabaseArgs,
            isRollback
                ? [...connectionArgs, '-Dtest-db', '-e' + sql]
                : [...connectionArgs, '-Dtest-db', '-e', sql],
            createDatabaseArgs
        ];
        let executionCount = 0;
        let connectionCheckCount = 0;

        
        tr.setInput('ServerName', 'MOCK_SERVER_NAME');
        tr.setInput("ConnectedServiceName", "DEMO_CONNECTED_SERVICE_NAME");
        tr.setInput('SqlUsername', username);
        tr.setInput('SqlPassword', password);
        tr.setInput('TaskNameSelector', 'InlineSqlTask');
        tr.setInput('SqlInline', sql);
        tr.setInput('SqlFile', sqlFilePath);
        tr.setInput('SqlAdditionalArguments', '--quick --connect-timeout=10');

        // Task-lib captures inputs in its vault when first loaded.
        const tl = await import('azure-pipelines-task-lib/task');
        // Explicitly mock the rollback flag (rather than leaving it unset) so each run
        // demonstrates its intended path even if the environment happens to define the
        // feature-flag variable, and so a future accidental default flip is caught here.
        tr.registerMockExport('getPipelineFeature', (_featureName: string) => isRollback);
        tr.registerMockExport('execSync', (tool: string, args: string[]) => {
            assert.strictEqual(tool, '/usr/local/bin/mysql');
            assert.deepStrictEqual(args, connectionArgs);
            connectionCheckCount++;
            return {
                code: 1,
                stdout: '',
                stderr: "ERROR 9000 (HY000): Client with IP address '250.250.250.250' is not allowed to connect to this MySQL server."
            };
        });
        tr.registerMockExport('exec', async (tool: string, args: string[]) => {
            assert.strictEqual(tool, '/usr/local/bin/mysql');
            assert.deepStrictEqual(args, expectedExecutions[executionCount], `Unexpected SQL execution ${executionCount}.`);
            executionCount++;
            return 0;
        });
        tr.registerMockExport('setResult', (result: TaskResult, message: string) => {
            if (result === tl.TaskResult.Succeeded) {
                assert.strictEqual(connectionCheckCount, 1, 'The firewall connection check must run.');
                assert.strictEqual(executionCount, expectedExecutions.length, 'Every expected SQL execution must run.');
            }
            tl.setResult(result, message);
        });
        tr.registerMock('azure-pipelines-tasks-webdeployment-common/packageUtility.js', {
            PackageUtility: {
                getPackagePath: (filePath: string) => filePath
            }
        });
        tr.registerMock('fs', {
            existsSync: (filePath: string) => filePath === sqlFilePath,
            createReadStream: (filePath: string) => {
                assert.strictEqual(filePath, sqlFilePath);
                return Readable.from([Buffer.from(sql, 'utf8')]);
            }
        });
        tr.run();
    }
}

MysqlClientExecTests.startTests().catch((error: Error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
});
