import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as path from 'path';
import { MysqlClient } from '../sql/MysqlClient';
import { Utility } from '../operations/MysqlUtiliy';
import { isValidDatabaseName } from '../models/MysqlTaskParameter';

describe('MySqlDeployment Suite', function() {

    this.timeout(60000);

    it('MySqlDeployment ToolPathOperationTests', async () => {
        let tp = path.join(__dirname, 'ToolPathOperationTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.stdOutContained('ToolPathOperationsL0Tests.getInstalledPathOfMysqlForLinux should has passed.'), 'Should have printed: ToolPathOperationsL0Tests.getInstalledPathOfMysqlForLinux should has passed.');
    });
    
    it('MySqlDeployment MysqlClient', async () => {
        let tp = path.join(__dirname, 'MysqlClientTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.stdOutContained('MysqlClientL0Tests.executeSqlCommand should has passed'), 'Should have printed: MysqlClientL0Tests.executeSqlCommand should has passed.');
    });

    // Every mysql invocation (InlineSqlTask/SqlTaskFile, with/without DatabaseName)
    // must filter untrusted tool output through the external-output marker filter.
    async function runMysqlClientExecTest(selector: 'InlineSqlTask' | 'SqlTaskFile', withDatabase: boolean): Promise<void> {
        const selectorEnvVar = 'MYSQL_MACHINEGROUP_TEST_SELECTOR';
        const withDbEnvVar = 'MYSQL_MACHINEGROUP_TEST_WITHDB';
        const previousSelector = process.env[selectorEnvVar];
        const previousWithDb = process.env[withDbEnvVar];
        try {
            process.env[selectorEnvVar] = selector;
            process.env[withDbEnvVar] = withDatabase ? 'true' : 'false';
            const tp = path.join(__dirname, 'MysqlClientExecTests.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            await tr.runAsync();
            assert.strictEqual(tr.succeeded, true, tr.stdout + tr.stderr);
            assert(tr.stdOutContained('MysqlClientExecL0Tests.executeSqlCommand passed.'),
                'Should have printed: MysqlClientExecL0Tests.executeSqlCommand passed.');
        } finally {
            if (previousSelector === undefined) { delete process.env[selectorEnvVar]; } else { process.env[selectorEnvVar] = previousSelector; }
            if (previousWithDb === undefined) { delete process.env[withDbEnvVar]; } else { process.env[withDbEnvVar] = previousWithDb; }
        }
    }

    it('MySqlDeployment filters output for InlineSqlTask with DatabaseName set', async () => {
        await runMysqlClientExecTest('InlineSqlTask', true);
    });

    it('MySqlDeployment filters output for InlineSqlTask with DatabaseName unset', async () => {
        await runMysqlClientExecTest('InlineSqlTask', false);
    });

    it('MySqlDeployment filters output for SqlTaskFile with DatabaseName set', async () => {
        await runMysqlClientExecTest('SqlTaskFile', true);
    });

    it('MySqlDeployment filters output for SqlTaskFile with DatabaseName unset', async () => {
        await runMysqlClientExecTest('SqlTaskFile', false);
    });

    it('MySqlDeployment task.json/task.loc.json deny all settable variables', () => {
        const expected = { settableVariables: { allowed: [] } };
        const taskJson = require(path.join(__dirname, '..', 'task.json'));
        const taskLocJson = require(path.join(__dirname, '..', 'task.loc.json'));
        assert.deepStrictEqual(taskJson.restrictions, expected, 'task.json restrictions must deny every settable variable.');
        assert.deepStrictEqual(taskLocJson.restrictions, expected, 'task.loc.json restrictions must deny every settable variable.');
    });

    it('MySqlDeployment DatabaseName validation', () => {
        assert.strictEqual(isValidDatabaseName('database_name-1$'), true);
        assert.strictEqual(isValidDatabaseName('数据库_name-1$'), true);
        [
            'database.invalid',
            'database name',
            'database`name',
            "database'name",
            'database&name',
            'database|name',
            'database$(neutral)',
            'database\rname',
            'database\nname',
            'database\r',
            'database\n',
            'database\uD800name',
            'database\uDC00name',
            'database😀name'
        ].forEach((databaseName) => assert.strictEqual(isValidDatabaseName(databaseName), false));
    });

    async function runInvalidDatabaseNameTask(featureEnabled: boolean): Promise<ttm.MockTestRunner> {
        const featureEnvironmentVariable = 'DISTRIBUTEDTASK_TASKS_ENABLEMYSQLDEPLOYMENTDATABASENAMEVALIDATION';
        const previousFeatureValue = process.env[featureEnvironmentVariable];

        try {
            process.env[featureEnvironmentVariable] = featureEnabled ? 'true' : 'false';
            const tp = path.join(__dirname, 'L0InvalidDatabaseName.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            await tr.runAsync();
            return tr;
        }
        finally {
            if (previousFeatureValue === undefined) {
                delete process.env[featureEnvironmentVariable];
            }
            else {
                process.env[featureEnvironmentVariable] = previousFeatureValue;
            }
        }
    }

    it('MySqlDeployment validates DatabaseName before mysql execution when enabled', async () => {
        const tr = await runInvalidDatabaseNameTask(true);

        assert.strictEqual(tr.failed, true, 'Task should fail when validation is enabled.');
        assert.strictEqual(tr.stdOutContained('loc_mock_InvalidDatabaseName'), true, 'Task should report the DatabaseName validation error.');
        assert.strictEqual(tr.stdOutContained('MYSQL_EXECUTION_REACHED'), false, 'Task should validate DatabaseName before mysql execution.');
    });

    it('MySqlDeployment preserves DatabaseName baseline behavior when disabled', async () => {
        const tr = await runInvalidDatabaseNameTask(false);

        assert.strictEqual(tr.failed, false, 'Task should retain baseline behavior when validation is disabled.');
        assert.strictEqual(tr.stdOutContained('loc_mock_InvalidDatabaseName'), false, 'Task should not report the gated validation error.');
        assert.strictEqual(tr.stdOutContained('MYSQL_EXECUTION_REACHED'), true, 'Task should proceed to mysql execution when validation is disabled.');
    });

    it('validateSqlFilePath allows unsafe path when the validation is disabled by feature flag', () => {
        const featureEnvironmentVariable = 'DISTRIBUTEDTASK_TASKS_MYSQLDEPLOYMENTONMACHINEGROUP_DISABLESQLFILEPATHVALIDATION';
        const previousFeatureValue = process.env[featureEnvironmentVariable];
        try {
            process.env[featureEnvironmentVariable] = 'true';
            const p = 'a;b.sql';
            assert.strictEqual(Utility.validateSqlFilePath(p), p);
        }
        finally {
            if (previousFeatureValue === undefined) {
                delete process.env[featureEnvironmentVariable];
            }
            else {
                process.env[featureEnvironmentVariable] = previousFeatureValue;
            }
        }
    });

    it('validateSqlFilePath accepts ordinary paths', () => {
        const p = '/home/vsts/work/1/s/db/migrate_01.sql';
        assert.strictEqual(Utility.validateSqlFilePath(p), p);
    });

    ['x"; -h evil.example -e "SELECT 1 -- .sql', "x'.sql", 'a;b.sql', 'a`b.sql', 'a\nb.sql', 'a\rb.sql', 'a\0b.sql'].forEach((bad) => {
        it('validateSqlFilePath rejects unsafe path ' + JSON.stringify(bad), () => {
            assert.throws(() => Utility.validateSqlFilePath(bad), /InvalidSqlFilePath/);
        });
    });
});
