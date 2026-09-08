import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as path from 'path';
import { MysqlClient } from '../sql/MysqlClient';
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

});
