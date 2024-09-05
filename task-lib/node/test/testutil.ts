// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import path = require('path');
import util = require('util');
import stream = require('stream');
import os = require('os');
import child = require('child_process');
import shell = require('shelljs');
import fs = require('fs');

import * as tl from '../_build/task';

export function initialize(useRealStreams?: boolean) {
    if (useRealStreams) {
        tl.setStdStream(process.stdout);
        tl.setErrStream(process.stderr);
    }
    else {
        tl.setStdStream(this.getNullStream());
        tl.setErrStream(this.getNullStream());
    }

    process.env['TASKLIB_INPROC_UNITS'] = '1';
    tl.mkdirP(this.getTestTemp());
}

export function getTestTemp() {
    return path.join(__dirname, '_temp');
}

var NullStream = function () {
    stream.Writable.call(this);
    this._write = function (data, encoding, next) {
        next();
    }
}
util.inherits(NullStream, stream.Writable);

export function getNullStream() {
    return new NullStream();
}

export class StringStream extends stream.Writable {
    constructor() {
        super();
        stream.Writable.call(this);
    }

    private contents = '';

    public _write(data, encoding, next) {
        this.contents += data;
        next();
    }

    public getContents() {
        return this.contents;
    }
}

export function createStringStream() {
    return new StringStream();
}

export function buildOutput(lines: string[]): string {
    var output = '';
    lines.forEach(function (line) {
        output += line + os.EOL;
    });

    return output;
}

export function chmod(file: string, mode: string): void {
    let result = child.spawnSync('chmod', [ mode, file ]);
    if (result.status != 0) {
        let message: string = (result.output || []).join(' ').trim();
        throw new Error(`Command failed: "chmod ${mode} ${file}".  ${message}`);
    }
}

export function createHiddenDirectory(dir: string): void {
    if (!path.basename(dir).match(/^\./)) {
        throw new Error(`Expected dir '${dir}' to start with '.'.`);
    }

    shell.mkdir('-p', dir);
    if (os.platform() == 'win32') {
        let result = child.spawnSync('attrib.exe', [ '+H', dir ]);
        if (result.status != 0) {
            let message: string = (result.output || []).join(' ').trim();
            throw new Error(`Failed to set hidden attribute for directory '${dir}'. ${message}`);
        }
    }
};

export function createHiddenFile(file: string, content: string): void {
    if (!path.basename(file).match(/^\./)) {
        throw new Error(`Expected dir '${file}' to start with '.'.`);
    }

    shell.mkdir('-p', path.dirname(file));
    fs.writeFileSync(file, content);
    if (os.platform() == 'win32') {
        let result = child.spawnSync('attrib.exe', [ '+H', file ]);
        if (result.status != 0) {
            let message: string = (result.output || []).join(' ').trim();
            throw new Error(`Failed to set hidden attribute for file '${file}'. ${message}`);
        }
    }
};

/**
 * Creates a symlink directory on OSX/Linux, and a junction point directory on Windows.
 * A symlink directory is not created on Windows since it requires an elevated context.
 */
export function createSymlinkDir(real: string, link: string): void {
    if (os.platform() == 'win32') {
        fs.symlinkSync(real, link, 'junction');
    }
    else {
        fs.symlinkSync(real, link);
    }
};
export class ConsoleMocker {
    private _originalConsoleLog?: null | typeof console.log = null;
    private _originalConsoleWarn?: null | typeof console.warn = null;
    private _originalConsoleError?: null | typeof console.error = null;
    private _logs: string[] = [];
    private _warns: string[] = [];
    private _errors: string[] = [];

    constructor() {
        this.initialize();
    }

    private initialize() {
        this._originalConsoleLog = console.log;
        this._originalConsoleWarn = console.warn;
        this._originalConsoleError = console.error;
    }
    
    public mock() {
        console.log = (message?: string, ...optionalParams: any[]) => {
            this._logs.push(message);
        };
        console.warn = (message?: string, ...optionalParams: any[]) => {
            this._warns.push(message);
        };
        console.error = (message?: string, ...optionalParams: any[]) => {
            this._errors.push(message);
        };
    }

    public restore() {
        if (this._originalConsoleLog) console.log = this._originalConsoleLog;
        if (this._originalConsoleWarn) console.warn = this._originalConsoleWarn;
        if (this._originalConsoleError) console.error = this._originalConsoleError;

        this._logs = [];
        this._warns = [];
        this._errors = [];
    }

    public getLogs(): string[] {
        return this._logs;
    }

    public getWarns(): string[] {
        return this._warns;
    }

    public getErrors(): string[] {
        return this._errors;
    }
}