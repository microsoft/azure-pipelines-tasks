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
            '-uDEMO SQL USERNAME',
            '-pDEMO SQL PASSWORD',
            '--ssl-mode=REQUIRED',
            '--binary-mode',
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
        if (selector === 'SqlFile') {
            assert.deepStrictEqual(Buffer.concat(chunks), Buffer.from(scriptParameters.getSqlInline(), 'utf8'),
                'The SQL file must reach stdin without changing quotes, backslashes, or newlines.');
        }
    }
}

runTests()
    .then(() => tl.setResult(tl.TaskResult.Succeeded, 'Hardened SQL execution scenarios passed.'))
    .catch((error: Error) => tl.setResult(tl.TaskResult.Failed, error.stack || error.message));
