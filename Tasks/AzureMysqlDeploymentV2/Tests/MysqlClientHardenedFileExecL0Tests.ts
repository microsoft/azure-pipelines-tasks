import tl = require('azure-pipelines-task-lib');
import { MysqlClient, SpawnFn } from '../sql/MysqlClient';
import { AzureMysqlTaskParameter } from '../models/AzureMysqlTaskParameter';
import { EventEmitter } from 'events';
import { PassThrough, Readable } from 'stream';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SQL_FILE_PATH = path.join(os.tmpdir(), 'test_azure_mysql_deploy_hardened.sql');
const HARDENING_FEATURE_ENV_VAR = 'DISTRIBUTEDTASK_TASKS_ENABLEAZUREMYSQLDEPLOYMENTV2BINARYMODEHARDENING';

/**
 * Same mock-spawn shape as MysqlClientFileExecL0Tests.ts's createMockSpawnFn: drains
 * stdin then emits 'close' with the given exit code, or emits 'error' instead.
 */
function createMockSpawnFn(exitCode: number, emitError?: Error): SpawnFn {
    return ((cmd: string, args: string[], opts: any) => {
        const proc = new EventEmitter() as any;
        proc.stdin = new PassThrough();

        if (emitError) {
            process.nextTick(() => {
                proc.emit('error', emitError);
            });
        } else {
            proc.stdin.resume();
            proc.stdin.on('end', () => {
                process.nextTick(() => {
                    proc.emit('close', exitCode);
                });
            });
        }

        return proc;
    }) as any;
}

function cleanupFile(filePath: string) {
    try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) { /* ignore */ }
}

export class MysqlClientHardenedFileExecL0Tests {

    public static params: AzureMysqlTaskParameter = new AzureMysqlTaskParameter();

    public static async startL0Tests() {
        const originalFeatureValue = process.env[HARDENING_FEATURE_ENV_VAR];
        process.env[HARDENING_FEATURE_ENV_VAR] = 'true';
        try {
            await MysqlClientHardenedFileExecL0Tests.hardenedFileExecNonZeroExit();
            await MysqlClientHardenedFileExecL0Tests.hardenedFileExecFileNotFound();
            await MysqlClientHardenedFileExecL0Tests.hardenedFileExecSpawnError();
            await MysqlClientHardenedFileExecL0Tests.hardenedFileExecStreamError();
        } finally {
            if (originalFeatureValue === undefined) {
                delete process.env[HARDENING_FEATURE_ENV_VAR];
            } else {
                process.env[HARDENING_FEATURE_ENV_VAR] = originalFeatureValue;
            }
        }
    }

    /**
     * Spawn exits with a non-zero code on the hardened (argv-array) file-exec path
     * -> promise rejects with SqlExecutionException, same as the FF-off helper.
     */
    public static async hardenedFileExecNonZeroExit() {
        try {
            fs.writeFileSync(SQL_FILE_PATH, 'SELECT 1;');
            const client = new MysqlClient(
                MysqlClientHardenedFileExecL0Tests.params,
                'DEMO_MYSQL_SERVER',
                '/usr/local/bin/mysql',
                createMockSpawnFn(1)
            );
            await client.executeSqlCommand();
            tl.setResult(tl.TaskResult.Failed, 'hardenedFileExecNonZeroExit: should have thrown.');
        } catch (error) {
            tl.setResult(tl.TaskResult.Succeeded, 'hardenedFileExecNonZeroExit passed.');
        } finally {
            cleanupFile(SQL_FILE_PATH);
        }
    }

    /**
     * SQL file does not exist on the hardened path -> promise rejects with
     * SqlFileNotFound before spawn is ever called.
     */
    public static async hardenedFileExecFileNotFound() {
        try {
            cleanupFile(SQL_FILE_PATH);
            const client = new MysqlClient(
                MysqlClientHardenedFileExecL0Tests.params,
                'DEMO_MYSQL_SERVER',
                '/usr/local/bin/mysql',
                createMockSpawnFn(0)
            );
            await client.executeSqlCommand();
            tl.setResult(tl.TaskResult.Failed, 'hardenedFileExecFileNotFound: should have thrown.');
        } catch (error) {
            tl.setResult(tl.TaskResult.Succeeded, 'hardenedFileExecFileNotFound passed.');
        }
    }

    /**
     * Spawn emits 'error' (e.g. ENOENT) on the hardened path -> promise rejects with
     * SqlExecutionException.
     */
    public static async hardenedFileExecSpawnError() {
        try {
            fs.writeFileSync(SQL_FILE_PATH, 'SELECT 1;');
            const client = new MysqlClient(
                MysqlClientHardenedFileExecL0Tests.params,
                'DEMO_MYSQL_SERVER',
                '/usr/local/bin/mysql',
                createMockSpawnFn(0, new Error('spawn ENOENT'))
            );
            await client.executeSqlCommand();
            tl.setResult(tl.TaskResult.Failed, 'hardenedFileExecSpawnError: should have thrown.');
        } catch (error) {
            tl.setResult(tl.TaskResult.Succeeded, 'hardenedFileExecSpawnError passed.');
        } finally {
            cleanupFile(SQL_FILE_PATH);
        }
    }

    /**
     * The SQL file's read stream emits 'error' mid-read (e.g. an I/O failure after the
     * existsSync check passed but before the file finished streaming) -> the pending
     * promise must still settle, rejecting with SqlExecutionException, on both the
     * hardened and FF-off helpers (neither suite previously covered this path).
     */
    public static async hardenedFileExecStreamError() {
        const originalCreateReadStream = fs.createReadStream;
        (fs as any).createReadStream = () => {
            const stream = new Readable({ read() { /* no-op */ } });
            process.nextTick(() => stream.emit('error', new Error('simulated read failure')));
            return stream as any;
        };
        try {
            fs.writeFileSync(SQL_FILE_PATH, 'SELECT 1;');
            const client = new MysqlClient(
                MysqlClientHardenedFileExecL0Tests.params,
                'DEMO_MYSQL_SERVER',
                '/usr/local/bin/mysql',
                createMockSpawnFn(0)
            );
            await client.executeSqlCommand();
            tl.setResult(tl.TaskResult.Failed, 'hardenedFileExecStreamError: should have thrown.');
        } catch (error) {
            tl.setResult(tl.TaskResult.Succeeded, 'hardenedFileExecStreamError passed.');
        } finally {
            (fs as any).createReadStream = originalCreateReadStream;
            cleanupFile(SQL_FILE_PATH);
        }
    }
}

MysqlClientHardenedFileExecL0Tests.startL0Tests();
