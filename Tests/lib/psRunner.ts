import Q = require('q');
import events = require('events');
import fs = require('fs');
import path = require('path');
import child = require('child_process');
var shell = require('shelljs');

function debug(message) {
    if (process.env['TASK_TEST_TRACE']) {
        console.log(message);
    }
}

export function testSupported() {
    if (!shell.which('powershell.exe')) {
        return false;
    }

    return (process.env['TASK_TEST_RUNNER'] || 'ps')
        .split(',')
        .some(function (x) {
            return x == 'ps';
        });
}

export class PSRunner extends events.EventEmitter {
	constructor() {
		super();
	}

	public stderr: string;
	public stdout: string;

	private _childProcess: child.ChildProcess;
	private _errors: string[];
	private _runDeferred: Q.Deferred<void>;

	public start(): void {
		this.emit('starting');
		var defer = Q.defer<void>();
		this._childProcess = child.spawn(
			"powershell.exe", // command
			[ // args
				'-NoLogo',
				'-Sta',
				'-NoProfile',
				'-NonInteractive',
				'-ExecutionPolicy',
				'Bypass',
				'-Command',
				'. ([System.IO.Path]::Combine(\'' + __dirname + '\', \'Start-TestRunner.ps1\'))'
			],
			{ // options
				cwd: __dirname,
				env: process.env
			});
		this._childProcess.stdout.on(
			'data',
			(data) => {
				// Check for special ouput indicating end of test.
				if (('' + data).indexOf('_END_OF_TEST_ce10a77a_') >= 0) {
					if (this._errors.length > 0) {
						this._runDeferred.reject(this._errors.join('\n'));
					} else {
						this._runDeferred.resolve(null);
					}
				} else if (data != '\n') {
					// Otherwise, normal stdout.
					debug('stdout: ' + data);
				}
			});
		this._childProcess.stderr.on(
			'data',
			(data) => {
				// Stderr indicates an error record was written to PowerShell's error pipeline.
				debug('stderr: ' + data);
				this._errors.push('' + data);
			});
	}

	public run (psPath: string, done) {
		this.runPromise(psPath)
		.then(() => {
			done();
		})
		.fail((err) => {
			done(err);
		});
	}

	public runPromise(psPath: string): Q.Promise<void> {
		this.emit('running test');
		this._errors = [];
		this._runDeferred = Q.defer<void>();
		this._childProcess.stdin.write(psPath + '\n')
		return <Q.Promise<void>>this._runDeferred.promise;
	}

	public kill(): void {
		this._childProcess.kill();
	}
}
