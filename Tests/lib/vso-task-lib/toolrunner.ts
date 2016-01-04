
/// <reference path="../../../definitions/node.d.ts" />
/// <reference path="../../../definitions/Q.d.ts" />

import Q = require('q');
import os = require('os');
import events = require('events');
import mock = require('./mock');

var run = function(cmd, callback) {
    console.log('running: ' + cmd);
    var output = '';
    try {

    }
    catch (err) {
        console.log(err.message);
    }

}

export interface IExecOptions {
    cwd: string;
    env: { [key: string]: string };
    silent: boolean;
    failOnStdErr: boolean;
    ignoreReturnCode: boolean;
    outStream: NodeJS.WritableStream;
    errStream: NodeJS.WritableStream;
};

export interface IExecResult {
    stdout: string;
    stderr: string;
    code: number;
    error: Error;
}

export function debug(message) {
    // do nothing, overridden
};

export class ToolRunner extends events.EventEmitter {
    constructor(toolPath) {
        debug('toolRunner toolPath: ' + toolPath);

        this.toolPath = toolPath;
        this.args = [];
        this.silent = false;
        super();
    }

    public toolPath: string;
    public args: string[];
    public silent: boolean;

    private _debug(message) {
        if (!this.silent) {
            debug(message);
        }
        this.emit('debug', message);
    }

    private _argStringToArray(argString: string): string[] {
        var args = argString.match(/([^" ]*("[^"]*")[^" ]*)|[^" ]+/g);
        //remove double quotes from each string in args as child_process.spawn() cannot handle literla quotes as part of arguments
        for (var i = 0; i < args.length; i++) {
            args[i] = args[i].replace(/"/g, "");
        }
        return args;
    }

    public arg(val: any) {
        if (!val) {
            return;
        }

        if (val instanceof Array) {
            this._debug(this.toolPath + ' arg: ' + JSON.stringify(val));
            this.args = this.args.concat(val);
        }
        else if (typeof (val) === 'string') {
            this._debug(this.toolPath + ' arg: ' + val);
            this.args = this.args.concat(this._argStringToArray(val));
        }
    }

    public argIf(condition: any, val: any) {
        if (condition) {
            this.arg(val);
        }
    }

    //
    // Exec - use for long running tools where you need to stream live output as it runs
    //        returns a promise with return code.
    //
    public exec(options: IExecOptions): Q.Promise<number> {
        var defer = Q.defer<number>();

        this._debug('exec tool: ' + this.toolPath);
        this._debug('Arguments:');
        this.args.forEach((arg) => {
            this._debug('   ' + arg);
        });

        var success = true;
        options = options || <IExecOptions>{};

        var ops: IExecOptions = {
            cwd: options.cwd || process.cwd(),
            env: options.env || process.env,
            silent: options.silent || false,
            outStream: options.outStream || process.stdout,
            errStream: options.errStream || process.stderr,
            failOnStdErr: options.failOnStdErr || false,
            ignoreReturnCode: options.ignoreReturnCode || false
        };

        var argString = this.args.join(' ') || '';
        var cmdString = this.toolPath;
        if (argString) {
            cmdString += (' ' + argString);
        }

        if (!ops.silent) {
            ops.outStream.write('[command]' + cmdString + os.EOL);
        }

        // TODO: filter process.env

        var res = mock.getResponse('exec', cmdString);
        //console.log(JSON.stringify(res, null, 2));
        if (res.stdout) {
            this.emit('stdout', res.stdout);

            if (!ops.silent) {
                ops.outStream.write(res.stdout + os.EOL);
            }
        }

        if (res.stderr) {
            this.emit('stderr', res.stderr);

            success = !ops.failOnStdErr;
            if (!ops.silent) {
                var s = ops.failOnStdErr ? ops.errStream : ops.outStream;
                s.write(res.stderr + os.EOL);
            }
        }


        var code = res.code;

        ops.outStream.write('rc:' + res.code + os.EOL);

        if (code != 0 && !ops.ignoreReturnCode) {
            success = false;
        }

        ops.outStream.write('success:' + success + os.EOL);
        if (success) {
            defer.resolve(code);
        }
        else {
            defer.reject(new Error(this.toolPath + ' failed with return code: ' + code));
        }

        return <Q.Promise<number>>defer.promise;
    }

    //
    // ExecSync - use for short running simple commands.  Simple and convenient (synchronous)
    //            but also has limits.  For example, no live output and limited to max buffer
    //
    public execSync(options: IExecOptions): IExecResult {
        var defer = Q.defer();

        this._debug('exec tool: ' + this.toolPath);
        this._debug('Arguments:');
        this.args.forEach((arg) => {
            this._debug('   ' + arg);
        });

        var success = true;
        options = options || <IExecOptions>{};

        var ops: IExecOptions = {
            cwd: options.cwd || process.cwd(),
            env: options.env || process.env,
            silent: options.silent || false,
            outStream: options.outStream || process.stdout,
            errStream: options.errStream || process.stderr,
            failOnStdErr: options.failOnStdErr || false,
            ignoreReturnCode: options.ignoreReturnCode || false
        };

        var argString = this.args.join(' ') || '';
        var cmdString = this.toolPath;
        if (argString) {
            cmdString += (' ' + argString);
        }

        if (!ops.silent) {
            ops.outStream.write('[command]' + cmdString + os.EOL);
        }

        var r = mock.getResponse('exec', cmdString);
        if (r.stdout.length > 0) {
            ops.outStream.write(r.stdout);
        }

        if (r.stderr.length > 0) {
            ops.errStream.write(r.stderr);
        }

        return <IExecResult>{ code: r.code, stdout: r.stdout, stderr: r.stderr };
    }
}
