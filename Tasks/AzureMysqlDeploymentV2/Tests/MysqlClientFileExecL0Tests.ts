import tl = require('azure-pipelines-task-lib');
import { MysqlClient, SpawnFn } from '../sql/MysqlClient';
import { AzureMysqlTaskParameter } from '../models/AzureMysqlTaskParameter';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SQL_FILE_PATH = path.join(os.tmpdir(), 'test_azure_mysql_deploy.sql');

/**
 * Creates a mock spawn function that returns a fake child process.
 * The mock process drains stdin (so the pipe completes) then emits
 * either 'close' with the given exit code, or 'error' with the given error.
 */
function createMockSpawnFn(exitCode: number, emitError?: Error): SpawnFn {
    return ((cmd: string, args: string[], opts: any) => {
        const proc = new EventEmitter() as any;
        proc.stdin = new PassThrough();

        if (emitError) {
            // Emit error on next tick (before stdin drains), mimicking spawn ENOENT.
            process.nextTick(() => {
                proc.emit('error', emitError);
            });
        } else {
            // Drain stdin so the pipe from createReadStream completes, then close.
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

export class MysqlClientFileExecL0Tests {

    public static params: AzureMysqlTaskParameter = new AzureMysqlTaskParameter();

    public static async startL0Tests() {
        await MysqlClientFileExecL0Tests.fileExecSuccess();
        await MysqlClientFileExecL0Tests.fileExecNonZeroExit();
        await MysqlClientFileExecL0Tests.fileExecFileNotFound();
        await MysqlClientFileExecL0Tests.fileExecSpawnError();
    }

    /**
     * Happy path: SQL file exists, spawn exits 0, promise resolves with 0.
     */
    public static async fileExecSuccess() {
        try {
            fs.writeFileSync(SQL_FILE_PATH, 'SELECT 1;');
            const client = new MysqlClient(
                MysqlClientFileExecL0Tests.params,
                'DEMO_MYSQL_SERVER',
                '/usr/local/bin/mysql',
                createMockSpawnFn(0)
            );
            const result = await client.executeSqlCommand();
            if (result === 0) {
                tl.setResult(tl.TaskResult.Succeeded, 'fileExecSuccess passed.');
            } else {
                tl.setResult(tl.TaskResult.Failed, 'fileExecSuccess: expected 0 but got ' + result);
            }
        } catch (error) {
            tl.setResult(tl.TaskResult.Failed, 'fileExecSuccess failed: ' + error.message);
        } finally {
            cleanupFile(SQL_FILE_PATH);
        }
    }

    /**
     * Spawn exits with non-zero code → promise rejects with SqlExecutionException.
     */
    public static async fileExecNonZeroExit() {
        try {
            fs.writeFileSync(SQL_FILE_PATH, 'SELECT 1;');
            const client = new MysqlClient(
                MysqlClientFileExecL0Tests.params,
                'DEMO_MYSQL_SERVER',
                '/usr/local/bin/mysql',
                createMockSpawnFn(1)
            );
            await client.executeSqlCommand();
            tl.setResult(tl.TaskResult.Failed, 'fileExecNonZeroExit: should have thrown.');
        } catch (error) {
            tl.setResult(tl.TaskResult.Succeeded, 'fileExecNonZeroExit passed.');
        } finally {
            cleanupFile(SQL_FILE_PATH);
        }
    }

    /**
     * SQL file does not exist → promise rejects with SqlFileNotFound.
     */
    public static async fileExecFileNotFound() {
        try {
            cleanupFile(SQL_FILE_PATH);
            const client = new MysqlClient(
                MysqlClientFileExecL0Tests.params,
                'DEMO_MYSQL_SERVER',
                '/usr/local/bin/mysql',
                createMockSpawnFn(0)
            );
            await client.executeSqlCommand();
            tl.setResult(tl.TaskResult.Failed, 'fileExecFileNotFound: should have thrown.');
        } catch (error) {
            tl.setResult(tl.TaskResult.Succeeded, 'fileExecFileNotFound passed.');
        }
    }

    /**
     * Spawn emits 'error' (e.g. ENOENT) → promise rejects with SqlExecutionException.
     */
    public static async fileExecSpawnError() {
        try {
            fs.writeFileSync(SQL_FILE_PATH, 'SELECT 1;');
            const client = new MysqlClient(
                MysqlClientFileExecL0Tests.params,
                'DEMO_MYSQL_SERVER',
                '/usr/local/bin/mysql',
                createMockSpawnFn(0, new Error('spawn ENOENT'))
            );
            await client.executeSqlCommand();
            tl.setResult(tl.TaskResult.Failed, 'fileExecSpawnError: should have thrown.');
        } catch (error) {
            tl.setResult(tl.TaskResult.Succeeded, 'fileExecSpawnError passed.');
        } finally {
            cleanupFile(SQL_FILE_PATH);
        }
    }
}

MysqlClientFileExecL0Tests.startL0Tests();
