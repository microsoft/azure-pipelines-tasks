import { EventEmitter } from 'events';
import { ChildProcess, spawn } from 'child_process';

import shell from 'shelljs';

function debug(message: string): void {
    if (process.env['TASK_TEST_TRACE']) {
        console.log(message);
    }
}

// Thanks to https://stackoverflow.com/a/34637436
class DeferredPromise {
    public promise: Promise<void>
    public resolve: () => void
    public reject: (reason: any) => void

    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.reject = reject
            this.resolve = resolve
        })
    }
}

class PSEngineRunner extends EventEmitter {
    constructor() {
        super();
    }

    private childProcess: ChildProcess;
    private errors: string[];
    private dp: DeferredPromise;

    public stderr: string;
    public stdout: string;

    public ensureKill(): void {
        if (this.childProcess) {
            this.childProcess.kill();
        }
    }

    public run(psPath: string, done: (err?: any) => void): void {
        this.ensureStarted();
        this.runPromise(psPath)
            .then(() => done())
            .catch((err) => done(err));
    }

    private ensureStarted(): void {
        if (this.childProcess) {
            return;
        }

        const powershell = shell.which('powershell.exe')?.stdout;
        if (!powershell) {
            throw new Error('powershell.exe not found');
        }

        this.emit('starting');
        this.childProcess = spawn(
            powershell, // command
            [ // args
                '-NoLogo',
                '-Sta',
                '-NoProfile',
                '-NonInteractive',
                '-ExecutionPolicy',
                'Bypass',
                '-Command',
                '. ([System.IO.Path]::Combine(\'' + __dirname + '\', \'Start-Engine.ps1\'))'
            ],
            { // options
                cwd: __dirname,
                env: process.env
            });
        this.childProcess.stdout.on(
            'data',
            (data) => {
                // Check for special ouput indicating end of test.
                if (('' + data).indexOf('_END_OF_TEST_ce10a77a_') >= 0) {
                    if (this.errors.length > 0) {
                        this.dp.reject(this.errors.join('\n'));
                    } else {
                        this.dp.resolve();
                    }
                } else if (data != '\n') {
                    if (('' + data).match(/##vso\[task.logissue .*type=error/)) {
                        // The VstsTaskSdk converts error records to error issue commands.
                        debug('stdout: ' + data);
                        this.errors.push(data);
                    } else {
                        // Otherwise, normal stdout.
                        debug('stdout: ' + data);
                    }
                }
            });
        this.childProcess.stderr.on(
            'data',
            (data) => {
                // Stderr indicates an error record was written to PowerShell's error pipeline.
                debug('stderr: ' + data);
                this.errors.push(data);
            });
    }

    private runPromise(psPath: string): Promise<void> {
        this.emit('running test');

        this.errors = [];
        this.dp = new DeferredPromise();
        this.childProcess.stdin.write(psPath + '\n')

        return this.dp.promise;
    }
}

const engineRunner: PSEngineRunner = new PSEngineRunner();

export function run(psPath: string, done: (err?: any) => void): void {
    engineRunner.run(psPath, done);
}

export function ensureStopped(): void {
    engineRunner.ensureKill();
}

export default { run, ensureStopped };
