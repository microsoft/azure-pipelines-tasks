import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tmrm = require('azure-pipelines-task-lib/mock-run');
import tl = require('azure-pipelines-task-lib');
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { MysqlClient } from '../sql/MysqlClient';
import { FirewallConfiguration } from '../models/FirewallConfiguration';
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

    // MysqlClientExecTests.js and MysqlClientExecFailureTests.js are shared wrappers
    // driven under both feature-flag states; the state is communicated via this env
    // var, which each spawned wrapper process inherits from this one.
    const hardeningFeatureEnvVar = 'DISTRIBUTEDTASK_TASKS_ROLLBACKAZUREMYSQLDEPLOYMENTV2BINARYMODEHARDENING';

    async function runWithHardeningFlag(rollback: boolean, run: () => Promise<void>): Promise<void> {
        const originalFeatureValue = process.env[hardeningFeatureEnvVar];
        process.env[hardeningFeatureEnvVar] = rollback ? 'true' : 'false';
        try {
            await run();
        } finally {
            if (originalFeatureValue === undefined) {
                delete process.env[hardeningFeatureEnvVar];
            } else {
                process.env[hardeningFeatureEnvVar] = originalFeatureValue;
            }
        }
    }

    it('AzureMySqlDeployment hardened SQL execution preserves argv and file content', async () => {
        await runWithHardeningFlag(false, async () => {
            let tp = path.join(__dirname, 'MysqlClientExecTests.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            await tr.runAsync();
            assert.strictEqual(tr.succeeded, true, tr.stdout + tr.stderr);
            assert.deepStrictEqual(tr.errorIssues, [], tr.stdout + tr.stderr);
            assert(tr.stdOutContained('Hardened SQL execution scenarios passed.'), 'All hardened execution scenarios must complete.');
        });
    });

    it('AzureMySqlDeployment FF-on (rollback) SQL execution preserves pre-hardening argv, stdin, and error behavior', async () => {
        await runWithHardeningFlag(true, async () => {
            let tp = path.join(__dirname, 'MysqlClientExecTests.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            await tr.runAsync();
            assert.strictEqual(tr.succeeded, true, tr.stdout + tr.stderr);
            assert.deepStrictEqual(tr.errorIssues, [], tr.stdout + tr.stderr);
            assert(tr.stdOutContained('Rollback (FF-on) SQL execution scenarios passed.'), 'All FF-on (rollback) execution scenarios must complete.');
        });
    });

    it('AzureMySqlDeployment hardened exec-based SQL execution surfaces a non-zero mysql exit code as a failure', async () => {
        await runWithHardeningFlag(false, async () => {
            let tp = path.join(__dirname, 'MysqlClientExecFailureTests.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            await tr.runAsync();
            assert(tr.stdOutContained('execNonZeroExit passed.'), 'Should have printed: execNonZeroExit passed.');
        });
    });

    it('AzureMySqlDeployment FF-on (rollback) exec-based SQL execution surfaces a non-zero mysql exit code as a failure', async () => {
        await runWithHardeningFlag(true, async () => {
            let tp = path.join(__dirname, 'MysqlClientExecFailureTests.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            await tr.runAsync();
            assert(tr.stdOutContained('execNonZeroExit passed.'), 'Should have printed: execNonZeroExit passed.');
        });
    });

    describe('MysqlClient binary-mode option ownership', () => {
        // Hardening is on by default, so these tests explicitly mock the rollback flag
        // false (rather than leaving it unset) to make that default unambiguous.
        const rollbackFeatureEnvVar = 'DISTRIBUTEDTASK_TASKS_ROLLBACKAZUREMYSQLDEPLOYMENTV2BINARYMODEHARDENING';
        
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
            originalFeatureValue = process.env[rollbackFeatureEnvVar];
            process.env[rollbackFeatureEnvVar] = 'false';
            tl.setResourcePath(path.join(__dirname, '..', 'task.json'));
        });

        afterEach(() => {
            if (originalFeatureValue === undefined) {
                delete process.env[rollbackFeatureEnvVar];
            } else {
                process.env[rollbackFeatureEnvVar] = originalFeatureValue;
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

        it('accepts a value-consuming option whose separate-token value merely looks like --binary-mode', () => {
            for (const additionalArguments of [
                '--prompt --binary-mode',
                '--prompt "--skip-binary-mode"',
                '--host --binary-mode=0'
            ]) {
                assert.doesNotThrow(() => createClient(additionalArguments));
            }
        });

        it('still rejects a real --binary-mode token following an unrelated option', () => {
            assert.throws(
                () => createClient('--quick --binary-mode'),
                /not allowed.*--binary-mode/);
        });

        it('preserves acceptance of all binary-mode forms when the rollback flag is true', () => {
            process.env[rollbackFeatureEnvVar] = 'true';
            for (const additionalArguments of reservedArguments) {
                assert.doesNotThrow(
                    () => createClient(additionalArguments),
                    `Rollback (FF-on) must continue accepting ${additionalArguments}.`);
            }
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
        assert(tr.stdOutContained('fileExecStreamError passed.'), 'Should have printed: fileExecStreamError passed.');
    });

});
