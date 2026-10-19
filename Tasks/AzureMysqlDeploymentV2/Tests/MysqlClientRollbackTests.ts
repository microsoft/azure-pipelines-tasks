import * as assert from 'assert';
import type { TaskResult } from 'azure-pipelines-task-lib/task';
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as path from 'path';
import { Readable } from 'stream';

// FF-off (rollback) counterpart of MysqlClientHardenedTests.ts: verifies that when
// the feature flag is absent/false, MysqlClient continues to produce the same argv
// construction, CREATE DATABASE and inline-SQL/file-SQL execution sequence, and the
// same stdin/error behavior as before this PR.
export class MysqlClientRollbackTests {

    public static async startMysqlClientRollbackL0Tests(): Promise<void> {
        const tr = new TaskMockRunner(path.join(__dirname, 'MysqlClientRollbackL0Tests.js'));
        const sqlFilePath = path.join(__dirname, 'rollback script.sql');
        const sql = 'SELECT "quoted", \'single\', \'C:\\data\\file\';\nSELECT 2;';
        const connectionArgs = [
            '-hDEMO_MYSQL_SERVER',
            '-uDEMO_SQL_USERNAME',
            '-pDEMO_SQL_PASSWORD',
            '--ssl-mode=REQUIRED',
            '--quick',
            '--connect-timeout=10'
        ];
        // The ff-off path re-tokenizes a single built-up string (Utility.argStringToArray),
        // so '-e' and the SQL text collapse into one argv element, unlike the flag-on
        // array-based path where they are two discrete elements.
        const createDatabaseArgs = [...connectionArgs, '-eCREATE DATABASE IF NOT EXISTS `test-db` ;'];
        const expectedExecutions = [
            [...connectionArgs, '-e' + sql],
            createDatabaseArgs,
            [...connectionArgs, '-Dtest-db', '-e' + sql],
            createDatabaseArgs
        ];
        let executionCount = 0;
        let connectionCheckCount = 0;

        tr.setInput('IpDetectionMethod', 'IPAddressRange');
        tr.setInput('ServerName', 'MOCK_SERVER_NAME');
        tr.setInput('StartIpAddress', '0.0.0.0');
        tr.setInput("EndIpAddress", "255.255.255.255");
        tr.setInput("ConnectedServiceName", "DEMO_CONNECTED_SERVICE_NAME");
        tr.setInput('SqlUsername', 'DEMO_SQL_USERNAME');
        tr.setInput('SqlPassword', 'DEMO_SQL_PASSWORD');
        tr.setInput('TaskNameSelector', 'InlineSqlTask');
        tr.setInput('SqlInline', sql);
        tr.setInput('SqlFile', sqlFilePath);
        tr.setInput('SqlAdditionalArguments', '--quick --connect-timeout=10');

        // Task-lib captures inputs in its vault when first loaded.
        const tl = await import('azure-pipelines-task-lib/task');
        // Explicitly mock the flag false (rather than leaving it unset) so this test
        // demonstrates the FF-off path even if the environment happens to define the
        // feature-flag variable, and so a future accidental default flip is caught here.
        tr.registerMockExport('getPipelineFeature', (_featureName: string) => false);
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

MysqlClientRollbackTests.startMysqlClientRollbackL0Tests().catch((error: Error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
});
