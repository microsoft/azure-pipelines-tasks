import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tmrm = require('azure-pipelines-task-lib/mock-run');
import tl = require('azure-pipelines-task-lib');
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { MysqlClient } from '../sql/MysqlClient';
import { AzureMysqlTaskParameter } from '../models/AzureMysqlTaskParameter';

describe('AzureMySqlDeployment V2 Suite', function() {

    this.timeout(60000);

    it('AzureMySqlDeployment MysqlServerOperationsL0Tests', async () => {
        let tp = path.join(__dirname, 'MysqlServerOperationsL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.stdOutContained('MysqlServerOperationsTests.MysqlServerFromServerName should have passed.') , 'Should have printed: MysqlServerOperationsTests.MysqlServerFromServerName should have passed.');
        assert(tr.stdOutContained('MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to without id in mysql server.') , 'Should have printed: MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to without id in mysql server.');
        assert(tr.stdOutContained('MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to invalid id in mysql server.') , 'Should have printed: MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to invalid id in mysql server.');
        assert(tr.stdOutContained('MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to invalid mysql server name.') , 'Should have printed: MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to invalid mysql server name.');
    });

    it('AzureMySqlDeployment FirewallOperationTests', async () => {
        let tp = path.join(__dirname, 'FirewallOperationTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.stdOutContained('FirewallOperationsL0Tests.addFirewallRuleTest should have succeeded.'), 'Should have printed: FirewallOperationsL0Tests.addFirewallRuleTest should have succeeded.');
        assert(tr.stdOutContained('FirewallOperationsL0Tests.deleteFirewallRuleTest should have succeeded.'), 'Should have printed: FirewallOperationsL0Tests.deleteFirewallRuleTest should have succeeded.');
    });

    it('AzureMySqlDeployment ToolPathOperationTests', async () => {
        let tp = path.join(__dirname, 'ToolPathOperationTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.stdOutContained('ToolPathOperationsL0Tests.getInstalledPathOfMysqlForLinux should have passed.'), 'Should have printed: ToolPathOperationsL0Tests.getInstalledPathOfMysqlForLinux should have passed.');
    });
    
    it('AzureMySqlDeployment MysqlClient', async () => {
        let tp = path.join(__dirname, 'MysqlClientTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.stdOutContained('MysqlClientL0Tests.getFirewallConfiguration should have passed.'), 'Should have printed: MysqlClientL0Tests.getFirewallConfiguration should have passed.');
        assert(tr.stdOutContained('MysqlClientL0Tests.executeSqlCommand should have passed'), 'Should have printed: MysqlClientL0Tests.executeSqlCommand should have passed.');
    });

    it('AzureMySqlDeployment hardened SQL execution preserves argv and file content', async () => {
        let tp = path.join(__dirname, 'MysqlClientHardenedTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert.strictEqual(tr.succeeded, true, tr.stdout + tr.stderr);
        assert.deepStrictEqual(tr.errorIssues, [], tr.stdout + tr.stderr);
        assert(tr.stdOutContained('Hardened SQL execution scenarios passed.'), 'All hardened execution scenarios must complete.');
    });

    it('AzureMySqlDeployment FF-off (rollback) SQL execution preserves pre-hardening argv, stdin, and error behavior', async () => {
        let tp = path.join(__dirname, 'MysqlClientRollbackTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert.strictEqual(tr.succeeded, true, tr.stdout + tr.stderr);
        assert.deepStrictEqual(tr.errorIssues, [], tr.stdout + tr.stderr);
        assert(tr.stdOutContained('Rollback (FF-off) SQL execution scenarios passed.'), 'All FF-off execution scenarios must complete.');
    });

    it('AzureMySqlDeployment hardened exec-based SQL execution surfaces a non-zero mysql exit code as a failure', async () => {
        let tp = path.join(__dirname, 'MysqlClientHardenedExecFailureTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.stdOutContained('execNonZeroExit passed.'), 'Should have printed: execNonZeroExit passed.');
    });

    it('AzureMySqlDeployment FF-off (rollback) exec-based SQL execution surfaces a non-zero mysql exit code as a failure', async () => {
        let tp = path.join(__dirname, 'MysqlClientRollbackExecFailureTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.stdOutContained('execNonZeroExit passed.'), 'Should have printed: execNonZeroExit passed.');
    });

    describe('MysqlClient binary-mode option ownership', () => {
        const hardeningFeatureEnvVar = 'DISTRIBUTEDTASK_TASKS_ENABLEAZUREMYSQLDEPLOYMENTV2BINARYMODEHARDENING';
        // Representative cases covering each dimension of BINARY_MODE_OPTION_PATTERN
        // (plain form, a value suffix, underscore/case normalization, a negating
        // prefix, and stacked prefixes) rather than exhaustively enumerating every
        // spelling/casing permutation the regex accepts.
        const reservedArguments = [
            '--binary-mode',
            '--binary-mode=0',
            '--binary_mode=0',
            '--BINARY_MODE=OFF',
            '--skip-binary-mode',
            '--loose-skip-binary-mode',
            '--quick "--skip_binary-mode=1" --connect-timeout=10'
        ];
        let originalFeatureValue: string | undefined;

        function createClient(additionalArguments: string): MysqlClient {
            const parameters = {
                getSqlAdditionalArguments: () => additionalArguments,
                getSqlPassword: () => 'DEMO_SQL_PASSWORD'
            } as AzureMysqlTaskParameter;
            return new MysqlClient(parameters, 'DEMO_MYSQL_SERVER', '/usr/local/bin/mysql');
        }

        beforeEach(() => {
            originalFeatureValue = process.env[hardeningFeatureEnvVar];
            process.env[hardeningFeatureEnvVar] = 'true';
            tl.setResourcePath(path.join(__dirname, '..', 'task.json'));
        });

        afterEach(() => {
            if (originalFeatureValue === undefined) {
                delete process.env[hardeningFeatureEnvVar];
            } else {
                process.env[hardeningFeatureEnvVar] = originalFeatureValue;
            }
        });

        for (const additionalArguments of reservedArguments) {
            it(`rejects ${additionalArguments} when hardening is enabled`, () => {
                assert.throws(
                    () => createClient(additionalArguments),
                    /not allowed.*--binary-mode/,
                    `Expected binary-mode ownership validation to reject ${additionalArguments}.`);
            });
        }

        it('accepts unrelated options and binary-mode text inside option values', () => {
            for (const additionalArguments of [
                '',
                '--quick --connect-timeout=10',
                '--binary-as-hex --skip-column-names --ssl-mode=REQUIRED',
                '--init-command="SELECT \'--skip_binary-mode=1\';"',
                '--prompt=binary-mode'
            ]) {
                assert.doesNotThrow(() => createClient(additionalArguments));
            }
        });

        it('preserves acceptance of all binary-mode forms when hardening is absent or false', () => {
            for (const featureValue of [undefined, 'false']) {
                if (featureValue === undefined) {
                    delete process.env[hardeningFeatureEnvVar];
                } else {
                    process.env[hardeningFeatureEnvVar] = featureValue;
                }
                for (const additionalArguments of reservedArguments) {
                    assert.doesNotThrow(
                        () => createClient(additionalArguments),
                        `FF-off must continue accepting ${additionalArguments}.`);
                }
            }
        });
    });

    describe('MysqlClient defaults-file/option-file binary-mode scanning', () => {
        const hardeningFeatureEnvVar = 'DISTRIBUTEDTASK_TASKS_ENABLEAZUREMYSQLDEPLOYMENTV2BINARYMODEHARDENING';
        let originalFeatureValue: string | undefined;
        let tmpDir: string;

        function createClient(additionalArguments: string): MysqlClient {
            const parameters = {
                getSqlAdditionalArguments: () => additionalArguments,
                getSqlPassword: () => 'DEMO_SQL_PASSWORD'
            } as AzureMysqlTaskParameter;
            return new MysqlClient(parameters, 'DEMO_MYSQL_SERVER', '/usr/local/bin/mysql');
        }

        function writeFile(name: string, content: string): string {
            const filePath = path.join(tmpDir, name);
            fs.writeFileSync(filePath, content, 'utf8');
            return filePath;
        }

        beforeEach(() => {
            originalFeatureValue = process.env[hardeningFeatureEnvVar];
            process.env[hardeningFeatureEnvVar] = 'true';
            tl.setResourcePath(path.join(__dirname, '..', 'task.json'));
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mysql-defaults-'));
        });

        afterEach(() => {
            if (originalFeatureValue === undefined) {
                delete process.env[hardeningFeatureEnvVar];
            } else {
                process.env[hardeningFeatureEnvVar] = originalFeatureValue;
            }
            fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        it('rejects a binary-mode key inside a --defaults-file [client] section', () => {
            const cnfPath = writeFile('a.cnf', '[client]\nbinary-mode\n');
            assert.throws(() => createClient(`--defaults-file=${cnfPath}`), /--defaults-file.*not allowed/);
        });

        it('ignores a binary-mode key in a server-only ([mysqld]) section', () => {
            const cnfPath = writeFile('a.cnf', '[mysqld]\nbinary-mode\n');
            assert.doesNotThrow(() => createClient(`--defaults-file=${cnfPath}`));
        });

        it('short-circuits scanning entirely when --no-defaults is present', () => {
            const cnfPath = writeFile('a.cnf', '[client]\nbinary-mode\n');
            assert.doesNotThrow(() => createClient(`--no-defaults --defaults-file=${cnfPath}`));
        });
    });

    it('AzureMySqlDeployment MysqlClientFileExec', async () => {
        let tp = path.join(__dirname, 'MysqlClientFileExecTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.stdOutContained('fileExecSuccess passed.'), 'Should have printed: fileExecSuccess passed.');
        assert(tr.stdOutContained('fileExecNonZeroExit passed.'), 'Should have printed: fileExecNonZeroExit passed.');
        assert(tr.stdOutContained('fileExecFileNotFound passed.'), 'Should have printed: fileExecFileNotFound passed.');
        assert(tr.stdOutContained('fileExecSpawnError passed.'), 'Should have printed: fileExecSpawnError passed.');
    });

    it('AzureMySqlDeployment hardened MysqlClientFileExec failure scenarios (nonzero exit, spawn error, missing file, stream error)', async () => {
        let tp = path.join(__dirname, 'MysqlClientHardenedFileExecTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.stdOutContained('hardenedFileExecNonZeroExit passed.'), 'Should have printed: hardenedFileExecNonZeroExit passed.');
        assert(tr.stdOutContained('hardenedFileExecFileNotFound passed.'), 'Should have printed: hardenedFileExecFileNotFound passed.');
        assert(tr.stdOutContained('hardenedFileExecSpawnError passed.'), 'Should have printed: hardenedFileExecSpawnError passed.');
        assert(tr.stdOutContained('hardenedFileExecStreamError passed.'), 'Should have printed: hardenedFileExecStreamError passed.');
    });

});
