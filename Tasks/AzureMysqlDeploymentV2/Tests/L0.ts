import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tmrm = require('azure-pipelines-task-lib/mock-run');
import tl = require('azure-pipelines-task-lib');
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { MysqlClient } from '../sql/MysqlClient';
import { FirewallConfiguration } from '../models/FirewallConfiguration';
import { FirewallOperations } from '../operations/FirewallOperations';
import { MysqlServer } from '../models/MysqlServer';
import { AzureMysqlTaskParameter } from '../models/AzureMysqlTaskParameter';
import { getMockEndpoint, getMockFirewallRules } from './mock_utils';

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

    it('AzureMySqlDeployment hardened SQL execution preserves argv and file content with and without a database', async () => {
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
        assert(tr.stdOutContained('hardenedExecNonZeroExit passed.'), 'Should have printed: hardenedExecNonZeroExit passed.');
    });

    it('AzureMySqlDeployment FF-off (rollback) exec-based SQL execution surfaces a non-zero mysql exit code as a failure', async () => {
        let tp = path.join(__dirname, 'MysqlClientRollbackExecFailureTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.stdOutContained('rollbackExecNonZeroExit passed.'), 'Should have printed: rollbackExecNonZeroExit passed.');
    });

    describe('MysqlClient binary-mode option ownership', () => {
        const hardeningFeatureEnvVar = 'DISTRIBUTEDTASK_TASKS_ENABLEAZUREMYSQLDEPLOYMENTV2BINARYMODEHARDENING';
        const reservedArguments = [
            '--binary-mode',
            '--binary-mode=0',
            '--binary-mode=false',
            '--binary-mode=off',
            '--binary-mode=1',
            '--binary-mode=true',
            '--binary-mode=on',
            '--binary-mode=',
            '--binary-mode 0',
            '--binary_mode=0',
            '--BINARY_MODE=OFF',
            '--skip-binary-mode',
            '--skip-binary-mode=1',
            '--skip_binary-mode',
            '--skip-binary_mode',
            '--skip_binary_mode',
            '--disable-binary-mode',
            '--enable-binary-mode',
            '--enable_binary_mode=0',
            '--maximum-binary-mode=0',
            '--loose-binary-mode=0',
            '--loose-skip-binary-mode',
            '--loose-disable-binary-mode',
            '--loose_enable_skip_binary_mode=1',
            '--skip-disable-binary-mode',
            '--loose-loose-binary_mode=off',
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

        it('rejects a binary-mode key inside a --defaults-extra-file [client-server] section', () => {
            const cnfPath = writeFile('a.cnf', '[client-server]\nskip-binary-mode=1\n');
            assert.throws(() => createClient(`--defaults-extra-file=${cnfPath}`), /--defaults-extra-file.*not allowed/);
        });

        it('rejects a binary-mode key inside a [mysql] section', () => {
            const cnfPath = writeFile('a.cnf', '[mysql]\nbinary_mode=0\n');
            assert.throws(() => createClient(`--defaults-file=${cnfPath}`), /not allowed/);
        });

        it('ignores a binary-mode key in a server-only ([mysqld]) section', () => {
            const cnfPath = writeFile('a.cnf', '[mysqld]\nbinary-mode\n');
            assert.doesNotThrow(() => createClient(`--defaults-file=${cnfPath}`));
        });

        it('ignores an unrelated option and comment/blank lines in a [client] section', () => {
            const cnfPath = writeFile('a.cnf', '# comment\n\n[client]\n; comment\nquick\nport=3306\n');
            assert.doesNotThrow(() => createClient(`--defaults-file=${cnfPath}`));
        });

        it('widens scanning to a suffixed group when --defaults-group-suffix is present', () => {
            const cnfPath = writeFile('a.cnf', '[mysql-prod]\nbinary-mode\n');
            assert.throws(
                () => createClient(`--defaults-group-suffix=-prod --defaults-file=${cnfPath}`),
                /not allowed/);
        });

        it('does not scan a suffixed group when the matching --defaults-group-suffix is absent', () => {
            const cnfPath = writeFile('a.cnf', '[mysql-prod]\nbinary-mode\n');
            assert.doesNotThrow(() => createClient(`--defaults-file=${cnfPath}`));
        });

        it('short-circuits scanning entirely when --no-defaults is present', () => {
            const cnfPath = writeFile('a.cnf', '[client]\nbinary-mode\n');
            assert.doesNotThrow(() => createClient(`--no-defaults --defaults-file=${cnfPath}`));
        });

        it('follows a single-file !include chain to find a binary-mode key', () => {
            const includedPath = writeFile('included.cnf', '[client]\nbinary-mode\n');
            const mainPath = writeFile('main.cnf', `[client]\n!include ${includedPath}\n`);
            assert.throws(() => createClient(`--defaults-file=${mainPath}`), /not allowed/);
        });

        it('follows an !includedir chain to find a binary-mode key', () => {
            const includeDir = path.join(tmpDir, 'conf.d');
            fs.mkdirSync(includeDir);
            fs.writeFileSync(path.join(includeDir, 'extra.cnf'), '[client]\nbinary-mode\n', 'utf8');
            const mainPath = writeFile('main.cnf', `[client]\n!includedir ${includeDir}\n`);
            assert.throws(() => createClient(`--defaults-file=${mainPath}`), /not allowed/);
        });

        it('does not throw when an included file has no binary-mode key', () => {
            const includedPath = writeFile('included.cnf', '[client]\nquick\n');
            const mainPath = writeFile('main.cnf', `[client]\n!include ${includedPath}\n`);
            assert.doesNotThrow(() => createClient(`--defaults-file=${mainPath}`));
        });

        it('fails closed on an include chain deeper than the maximum allowed depth, even without a binary-mode key', () => {
            // MAX_DEFAULTS_FILE_INCLUDE_DEPTH is 10 (matches mysql/mariadb's own
            // max_recursion_level in my_default.c); build a chain of 12 benign files so
            // the depth guard - not a binary-mode match - is what trips the rejection.
            let previousPath: string | undefined;
            for (let i = 0; i < 12; i++) {
                const content = previousPath ? `[client]\n!include ${previousPath}\n` : '[client]\nquick\n';
                previousPath = writeFile(`chain${i}.cnf`, content);
            }
            assert.throws(() => createClient(`--defaults-file=${previousPath}`), /not allowed/);
        });

        it('fails closed on a cyclical !include chain, even without a binary-mode key', () => {
            const aPath = path.join(tmpDir, 'a.cnf');
            const bPath = path.join(tmpDir, 'b.cnf');
            fs.writeFileSync(aPath, `[client]\n!include ${bPath}\n`, 'utf8');
            fs.writeFileSync(bPath, `[client]\n!include ${aPath}\n`, 'utf8');
            assert.throws(() => createClient(`--defaults-file=${aPath}`), /not allowed/);
        });

        it('does not throw when the referenced defaults file does not exist (left to mysql to reject)', () => {
            const missingPath = path.join(tmpDir, 'missing.cnf');
            assert.doesNotThrow(() => createClient(`--defaults-file=${missingPath}`));
        });

        it('does not throw on a repeated, non-cyclic include of the same benign file from two parents', () => {
            // mysql does not track "visited" files - only chase depth - so a diamond
            // include (shared.cnf pulled in by both a.cnf and b.cnf) is legitimate and
            // must not be rejected merely because the file is reached twice.
            const sharedPath = writeFile('shared.cnf', '[client]\nquick\n');
            const aPath = writeFile('a.cnf', `[client]\n!include ${sharedPath}\n`);
            const bPath = writeFile('b.cnf', `[client]\n!include ${sharedPath}\n`);
            const mainPath = writeFile('main.cnf', `[client]\n!include ${aPath}\n!include ${bPath}\n`);
            assert.doesNotThrow(() => createClient(`--defaults-file=${mainPath}`));
        });

        it('rejects a binary-mode key reached via a repeated, non-cyclic include of the same file', () => {
            const sharedPath = writeFile('shared.cnf', '[client]\nbinary-mode\n');
            const aPath = writeFile('a.cnf', `[client]\n!include ${sharedPath}\n`);
            const bPath = writeFile('b.cnf', `[client]\n!include ${sharedPath}\n`);
            const mainPath = writeFile('main.cnf', `[client]\n!include ${aPath}\n!include ${bPath}\n`);
            assert.throws(() => createClient(`--defaults-file=${mainPath}`), /not allowed/);
        });

        it('ignores a non-.cnf/.ini file with a binary-mode key inside an !includedir directory', () => {
            const includeDir = path.join(tmpDir, 'conf.d');
            fs.mkdirSync(includeDir);
            fs.writeFileSync(path.join(includeDir, 'notes.txt'), '[client]\nbinary-mode\n', 'utf8');
            const mainPath = writeFile('main.cnf', `[client]\n!includedir ${includeDir}\n`);
            assert.doesNotThrow(() => createClient(`--defaults-file=${mainPath}`));
        });

        it('rejects a binary-mode key inside a section header followed by trailing comment text', () => {
            // mysql ignores anything after the closing bracket on a group-header line
            // rather than requiring the bracket to end the line.
            const cnfPath = writeFile('a.cnf', '[client] # trailing comment\nbinary-mode\n');
            assert.throws(() => createClient(`--defaults-file=${cnfPath}`), /not allowed/);
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

    it('AzureMySqlDeployment FirewallOperations retains rule-added state when post-add validation throws', async () => {
        const endpoint = getMockEndpoint();
        getMockFirewallRules();

        process.env["RELEASE_RELEASEID"] = "MOCK_RELEASE_ID";
        const originalDateNow = Date.now;
        Date.now = (): number => 12345;

        try {
            const firewallOperations = new FirewallOperations(endpoint.applicationTokenCredentials, endpoint.subscriptionID);
            const mysqlServer = new MysqlServer("MOCK_SERVER_NAME", "MOCK_SERVER_NAME.test-vm1.onebox.xdb.mscds.com", "MOCK_RESOURCE_GROUP_NAME");
            // Minimal ISqlClient/AzureMysqlTaskParameter doubles: only the methods invokeFirewallOperations
            // actually calls are implemented, avoiding a dependency on task-lib inputs for this unit test.
            const azureMysqlTaskParameter: any = {
                getIpDetectionMethod: () => 'IPAddressRange',
                getStartIpAddress: () => '0.0.0.0',
                getEndIpAddress: () => '255.255.255.255'
            };
            const sqlClient: any = {
                getFirewallConfiguration: () => new FirewallConfiguration(false, '250.250.250.250')
            };

            assert.strictEqual(firewallOperations.isFirewallRuleAdded(), false, 'isFirewallRuleAdded() should start false.');

            let threw = false;
            try {
                await firewallOperations.invokeFirewallOperations(azureMysqlTaskParameter, sqlClient, mysqlServer);
            } catch (error) {
                threw = true;
            }

            assert(threw, 'invokeFirewallOperations should throw when the agent IP is still missing after the rule was added.');
            assert.strictEqual(firewallOperations.isFirewallRuleAdded(), true, 'isFirewallRuleAdded() should remain true even though a later validation step threw, so callers still clean up the added rule.');

            // Mirrors azuremysqldeploy.ts's `finally` block: it gates cleanup on
            // isFirewallRuleAdded() (just asserted true above) and then calls
            // deleteFirewallRule(...) with the same two arguments. Exercising that call
            // here - rather than only checking the boolean - proves the rule the
            // entrypoint adds after a post-add validation failure is actually removable,
            // not merely flagged as added.
            await assert.doesNotReject(
                firewallOperations.deleteFirewallRule(mysqlServer.getName(), mysqlServer.getResourceGroupName()),
                'The entrypoint cleanup call (deleteFirewallRule) must succeed for the rule added above.'
            );
        } finally {
            Date.now = originalDateNow;
        }
    });

});
