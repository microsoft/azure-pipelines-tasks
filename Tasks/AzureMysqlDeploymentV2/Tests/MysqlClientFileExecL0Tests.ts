import tl = require('azure-pipelines-task-lib');
import { MysqlClient, SpawnFn } from '../sql/MysqlClient';
import { AzureMysqlTaskParameter } from '../models/AzureMysqlTaskParameter';
import { EventEmitter } from 'events';
import { PassThrough, Readable } from 'stream';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SQL_FILE_PATH = path.join(os.tmpdir(), 'test_azure_mysql_deploy.sql');

/**
 * Creates a mock spawn function that returns a fake child process.
 * The mock process provides real stdout/stderr PassThrough streams (mirroring
 * production's `stdio: ['pipe', 'pipe', 'pipe']`), optionally writes
 * `stdoutOutput`/`stderrOutput` to the respective stream, drains stdin (so the
 * pipe completes), ends stdout/stderr (mirroring Node's real "stdio streams end
 * before 'close'" contract), then emits either 'close' with the given exit
 * code, or 'error' with the given error.
 */
function createMockSpawnFn(exitCode: number, emitError?: Error, stderrOutput?: string, stdoutOutput?: string): SpawnFn {
    return ((cmd: string, args: string[], opts: any) => {
        const proc = new EventEmitter() as any;
        proc.stdin = new PassThrough();
        proc.stdout = new PassThrough();
        proc.stderr = new PassThrough();

        if (emitError) {
            // Emit error on next tick (before stdin drains), mimicking spawn ENOENT.
            process.nextTick(() => {
                proc.emit('error', emitError);
            });
        } else {
            // Drain stdin so the pipe from createReadStream completes, then close.
            proc.stdin.resume();
            proc.stdin.on('end', () => {
                if (stdoutOutput) {
                    proc.stdout.write(stdoutOutput);
                }
                if (stderrOutput) {
                    proc.stderr.write(stderrOutput);
                }
                proc.stdout.end();
                proc.stderr.end();
                process.nextTick(() => {
                    proc.emit('close', exitCode);
                });
            });
        }

        return proc;
    }) as any;
}

/**
 * Wraps createMockSpawnFn so callers can assert whether spawn was invoked at all
 * (e.g. to prove the file-existence check short-circuits before spawn is called).
 */
function createSpawnSpy(exitCode: number, emitError?: Error): { spawnFn: SpawnFn; wasCalled: () => boolean } {
    let called = false;
    const inner = createMockSpawnFn(exitCode, emitError);
    const spawnFn: SpawnFn = ((cmd: string, args: string[], opts: any) => {
        called = true;
        return (inner as any)(cmd, args, opts);
    }) as any;
    return { spawnFn, wasCalled: () => called };
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
        await MysqlClientFileExecL0Tests.fileExecStreamError();
        await MysqlClientFileExecL0Tests.fileExecNeutralizesVsoMarkerInStdoutOnSuccess();
        await MysqlClientFileExecL0Tests.fileExecNeutralizesVsoMarkerInStdoutOnFailure();
        await MysqlClientFileExecL0Tests.fileExecNeutralizesVsoMarkerInStderrOnSuccess();
        await MysqlClientFileExecL0Tests.fileExecNeutralizesVsoMarkerInStderrOnFailure();
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
     * SQL file does not exist → promise rejects with SqlFileNotFound, and spawn
     * must never be invoked (the file-existence check short-circuits first).
     */
    public static async fileExecFileNotFound() {
        const spy = createSpawnSpy(0);
        try {
            cleanupFile(SQL_FILE_PATH);
            const client = new MysqlClient(
                MysqlClientFileExecL0Tests.params,
                'DEMO_MYSQL_SERVER',
                '/usr/local/bin/mysql',
                spy.spawnFn
            );
            await client.executeSqlCommand();
            tl.setResult(tl.TaskResult.Failed, 'fileExecFileNotFound: should have thrown.');
        } catch (error) {
            if (spy.wasCalled()) {
                tl.setResult(tl.TaskResult.Failed, 'fileExecFileNotFound: spawn should not have been called.');
            } else {
                tl.setResult(tl.TaskResult.Succeeded, 'fileExecFileNotFound passed.');
            }
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

    /**
     * The SQL file's read stream emits 'error' mid-read (e.g. an I/O failure after the
     * existsSync check passed but before the file finished streaming) -> the pending
     * promise must still settle, rejecting with SqlExecutionException.
     */
    public static async fileExecStreamError() {
        const originalCreateReadStream = fs.createReadStream;
        (fs as any).createReadStream = () => {
            const stream = new Readable({ read() { /* no-op */ } });
            process.nextTick(() => stream.emit('error', new Error('simulated read failure')));
            return stream as any;
        };
        try {
            fs.writeFileSync(SQL_FILE_PATH, 'SELECT 1;');
            const client = new MysqlClient(
                MysqlClientFileExecL0Tests.params,
                'DEMO_MYSQL_SERVER',
                '/usr/local/bin/mysql',
                createMockSpawnFn(0)
            );
            await client.executeSqlCommand();
            tl.setResult(tl.TaskResult.Failed, 'fileExecStreamError: should have thrown.');
        } catch (error) {
            tl.setResult(tl.TaskResult.Succeeded, 'fileExecStreamError passed.');
        } finally {
            (fs as any).createReadStream = originalCreateReadStream;
            cleanupFile(SQL_FILE_PATH);
        }
    }

    /**
     * Shared assertion for the four marker-neutralization scenarios below: writes a
     * "##vso[" marker to the given stream (stdout - a query-result row; or stderr - e.g.
     * SIGNAL/error text raised by a trigger/procedure under a lower-privileged database
     * principal's control), drives executeSqlCommand() to the given exit code, and asserts
     * both that the marker reached the task host only in its neutralized "##_vso[" form,
     * and that the promise resolved/rejected as expected for that exit code. Exercising
     * both streams and both outcomes matters: a regression that dropped only the stdout
     * filter (or only the success-path filter) would otherwise go undetected.
     */
    private static async _assertVsoMarkerNeutralized(stream: 'stdout' | 'stderr', exitCode: number, testName: string): Promise<void> {
        const marker = '##vso[task.setvariable variable=PWNED]INJECTED_BY_TRIGGER';
        const neutralized = '##_vso[task.setvariable variable=PWNED]INJECTED_BY_TRIGGER';
        const target = stream === 'stdout' ? process.stdout : process.stderr;
        const originalWrite = target.write.bind(target);
        let captured = '';
        (target as any).write = (chunk: any) => {
            captured += chunk.toString();
            return true;
        };
        let resolved = false;
        let rejection: Error | undefined;
        try {
            fs.writeFileSync(SQL_FILE_PATH, 'SELECT 1;');
            const spawnFn = stream === 'stdout'
                ? createMockSpawnFn(exitCode, undefined, undefined, marker + '\n')
                : createMockSpawnFn(exitCode, undefined, marker + '\n');
            const client = new MysqlClient(
                MysqlClientFileExecL0Tests.params,
                'DEMO_MYSQL_SERVER',
                '/usr/local/bin/mysql',
                spawnFn
            );
            try {
                await client.executeSqlCommand();
                resolved = true;
            } catch (error) {
                rejection = error;
            }
            // Give the piped Transform stream a turn to flush before restoring the real stream.
            await new Promise((resolve) => setImmediate(resolve));
        } finally {
            // Restore the real stream BEFORE reporting the verdict below: tl.setResult()'s own
            // "##vso[task.complete]" message is written to process.stdout, and when `stream` is
            // 'stdout' that write must reach the real stream, not this capture buffer, or the
            // test's own pass/fail signal would be silently swallowed.
            (target as any).write = originalWrite;
            cleanupFile(SQL_FILE_PATH);
        }
        if (exitCode === 0 && !resolved) {
            tl.setResult(tl.TaskResult.Failed, testName + ': expected executeSqlCommand to resolve on exit code 0, but it rejected: ' + rejection?.message);
        } else if (exitCode !== 0 && resolved) {
            tl.setResult(tl.TaskResult.Failed, testName + ': expected executeSqlCommand to reject on exit code ' + exitCode + ', but it resolved.');
        } else if (captured.includes(marker)) {
            tl.setResult(tl.TaskResult.Failed, testName + ': raw vso marker reached ' + stream + ' unfiltered.');
        } else if (!captured.includes(neutralized)) {
            tl.setResult(tl.TaskResult.Failed, testName + ': neutralized marker not found in ' + stream + ': ' + captured);
        } else {
            tl.setResult(tl.TaskResult.Succeeded, testName + ' passed.');
        }
    }

    /**
     * Query-result data (e.g. a SELECT returning attacker-influenced row content) is the
     * realistic carrier for a stdout marker, reaching the task on the successful-exit path.
     */
    public static async fileExecNeutralizesVsoMarkerInStdoutOnSuccess() {
        await MysqlClientFileExecL0Tests._assertVsoMarkerNeutralized('stdout', 0, 'fileExecNeutralizesVsoMarkerInStdoutOnSuccess');
    }

    /**
     * mysql can still emit partial result data to stdout before failing outright.
     */
    public static async fileExecNeutralizesVsoMarkerInStdoutOnFailure() {
        await MysqlClientFileExecL0Tests._assertVsoMarkerNeutralized('stdout', 1, 'fileExecNeutralizesVsoMarkerInStdoutOnFailure');
    }

    /**
     * mysql can write warnings to stderr even when the overall invocation still succeeds.
     */
    public static async fileExecNeutralizesVsoMarkerInStderrOnSuccess() {
        await MysqlClientFileExecL0Tests._assertVsoMarkerNeutralized('stderr', 0, 'fileExecNeutralizesVsoMarkerInStderrOnSuccess');
    }

    /**
     * SIGNAL/error text raised by a trigger or stored procedure is the realistic carrier
     * for a stderr marker, reaching the task on the failing-exit path.
     */
    public static async fileExecNeutralizesVsoMarkerInStderrOnFailure() {
        await MysqlClientFileExecL0Tests._assertVsoMarkerNeutralized('stderr', 1, 'fileExecNeutralizesVsoMarkerInStderrOnFailure');
    }
}

MysqlClientFileExecL0Tests.startL0Tests();
