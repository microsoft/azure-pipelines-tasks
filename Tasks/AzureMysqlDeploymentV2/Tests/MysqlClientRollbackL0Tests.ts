import * as assert from 'assert';
import * as tl from 'azure-pipelines-task-lib/task';
import { ChildProcess, SpawnOptions } from 'child_process';
import { PassThrough } from 'stream';
import { AzureMysqlTaskParameter } from '../models/AzureMysqlTaskParameter';
import { MysqlClient, SpawnFn } from '../sql/MysqlClient';

class ScriptParameters extends AzureMysqlTaskParameter {
    constructor(private readonly selector: string, private readonly database: string) {
        super();
    }

    public getTaskNameSelector(): string {
        return this.selector;
    }

    public getDatabaseName(): string {
        return this.database;
    }
}

// FF-on (rollback) equivalent of MysqlClientHardenedL0Tests.ts: the rollback feature
// flag is mocked true by the caller (MysqlClientRollbackTests.ts), so MysqlClient falls
// back to its pre-hardening, string-tokenized construction (_getArgumentString/
// _getAdditionalArgument -> Utility.argStringToArray), with no --binary-mode anywhere
// in the resulting argv.
async function runTests(): Promise<void> {
    const parameters = new AzureMysqlTaskParameter();
    const configuration = new MysqlClient(parameters, 'DEMO_MYSQL_SERVER', '/usr/local/bin/mysql').getFirewallConfiguration();
    assert.strictEqual(configuration.isIpAdressAlreadyAdded(), false);
    assert.strictEqual(configuration.getIpAddress(), '250.250.250.250');

    for (const selector of ['InlineSqlTask', 'SqlFile']) {
        const database = 'test-db';
        const scriptParameters = new ScriptParameters(selector, database);
        const chunks: Buffer[] = [];
        let spawnCount = 0;
        const expectedArgs = [
            '-hDEMO_MYSQL_SERVER',
            '-uDEMO_SQL_USERNAME',
            '-pDEMO_SQL_PASSWORD',
            '--ssl-mode=REQUIRED',
            '--quick',
            '--connect-timeout=10',
            '-Dtest-db'
        ];

        const spawn = ((tool: string, args: string[], options: SpawnOptions) => {
            assert.strictEqual(selector, 'SqlFile', 'Inline SQL must use exec, not spawn.');
            assert.strictEqual(tool, '/usr/local/bin/mysql');
            assert.deepStrictEqual(args, expectedArgs);
            assert.deepStrictEqual(options, { stdio: ['pipe', 'inherit', 'inherit'] });
            spawnCount++;

            const mysqlProcess = new ChildProcess();
            const stdin = new PassThrough();
            mysqlProcess.stdin = stdin;
            stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
            stdin.on('finish', () => mysqlProcess.emit('close', 0));
            return mysqlProcess;
        }) as SpawnFn;

        const client = new MysqlClient(scriptParameters, 'DEMO_MYSQL_SERVER', '/usr/local/bin/mysql', spawn);
        assert.strictEqual(await client.executeSqlCommand(), 0, `${selector} with database '${database}' must succeed.`);
        assert.strictEqual(spawnCount, selector === 'SqlFile' ? 1 : 0);
        assert.ok(!expectedArgs.includes('--binary-mode'), 'FF-on (rollback) argv must never contain --binary-mode.');
        if (selector === 'SqlFile') {
            assert.deepStrictEqual(Buffer.concat(chunks), Buffer.from(scriptParameters.getSqlInline(), 'utf8'),
                'The SQL file must reach stdin without changing quotes, backslashes, or newlines, same as pre-hardening.');
        }
    }
}

runTests()
    .then(() => tl.setResult(tl.TaskResult.Succeeded, 'Rollback (FF-on) SQL execution scenarios passed.'))
    .catch((error: Error) => tl.setResult(tl.TaskResult.Failed, error.stack || error.message));
