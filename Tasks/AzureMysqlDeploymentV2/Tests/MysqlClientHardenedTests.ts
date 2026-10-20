import * as assert from 'assert';
import type { TaskResult } from 'azure-pipelines-task-lib/task';
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as path from 'path';
import { Readable } from 'stream';

export class MysqlClientHardenedTests {

    public static async startMysqlClientHardenedL0Tests(): Promise<void> {
        const tr = new TaskMockRunner(path.join(__dirname, 'MysqlClientHardenedL0Tests.js'));
        const sqlFilePath = path.join(__dirname, 'hardened script.sql');
        const sql = 'SELECT "quoted", \'single\', \'C:\\data\\file\';\nSELECT 2;';
        const connectionArgs = [
            '-hDEMO_MYSQL_SERVER',
            '-uDEMO SQL USERNAME',
            '-pDEMO SQL PASSWORD',
            '--ssl-mode=REQUIRED',
            '--binary-mode',
            '--quick',
            '--connect-timeout=10'
        ];
        const createDatabaseArgs = [...connectionArgs, '-e', 'CREATE DATABASE IF NOT EXISTS `test-db`;'];
        // MysqlClientHardenedL0Tests.ts drives both selectors (InlineSqlTask, SqlFile) against
        // a single database name ('test-db'). Each iteration creates the database first (task.exec),
        // then InlineSqlTask executes via task.exec while SqlFile executes via the injected spawn,
        // so only 3 task.exec calls are expected here.
        const expectedExecutions = [
            createDatabaseArgs,
            [...connectionArgs, '-Dtest-db', '-e', sql],
            createDatabaseArgs
        ];
        let executionCount = 0;
        let connectionCheckCount = 0;

        // ServerName, ConnectedServiceName, and TaskNameSelector are required inputs for
        // AzureMysqlTaskParameter's constructor, but this test drives MysqlClient directly
        // (not through azuremysqldeploy.ts/FirewallOperations), and ScriptParameters below
        // overrides getTaskNameSelector/getDatabaseName - so only their presence matters,
        // not their value. IpDetectionMethod/StartIpAddress/EndIpAddress are optional and
        // only consumed by FirewallOperations, which this test never exercises.
        tr.setInput('ServerName', 'MOCK_SERVER_NAME');
        tr.setInput("ConnectedServiceName", "DEMO_CONNECTED_SERVICE_NAME");
        tr.setInput('SqlUsername', 'DEMO SQL USERNAME');
        tr.setInput('SqlPassword', 'DEMO SQL PASSWORD');
        tr.setInput('TaskNameSelector', 'InlineSqlTask');
        tr.setInput('SqlInline', sql);
        tr.setInput('SqlFile', sqlFilePath);
        tr.setInput('SqlAdditionalArguments', '--quick --connect-timeout=10');

        // Task-lib captures inputs in its vault when first loaded.
        const tl = await import('azure-pipelines-task-lib/task');
        tr.registerMockExport('getPipelineFeature', (featureName: string) =>
            featureName === 'EnableAzureMysqlDeploymentV2BinaryModeHardening');
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

MysqlClientHardenedTests.startMysqlClientHardenedL0Tests().catch((error: Error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
});
