/// <reference path="../definitions/node.d.ts" />
/// <reference path="../definitions/Q.d.ts" />
declare module 'vso-task-lib/taskcommand' {
    export class TaskCommand {
        constructor(command: any, properties: any, message: any);
        command: string;
        message: string;
        properties: {
            [key: string]: string;
        };
        toString(): string;
    }
    export function commandFromString(commandLine: any): TaskCommand;

}
declare module 'vso-task-lib/toolrunner' {
    /// <reference path="../definitions/node.d.ts" />
    /// <reference path="../definitions/Q.d.ts" />
    import Q = require('q');
    import events = require('events');
    export interface IExecOptions {
        cwd: string;
        env: {
            [key: string]: string;
        };
        silent: boolean;
        failOnStdErr: boolean;
        ignoreReturnCode: boolean;
        outStream: NodeJS.WritableStream;
        errStream: NodeJS.WritableStream;
    }
    export interface IExecResult {
        stdout: string;
        stderr: string;
        code: number;
        error: Error;
    }
    export function debug(message: any): void;
    export class ToolRunner extends events.EventEmitter {
        constructor(toolPath: any);
        toolPath: string;
        args: string[];
        silent: boolean;
        private _debug(message);
        private _argStringToArray(argString);
        arg(val: any): void;
        argIf(condition: any, val: any): void;
        exec(options: IExecOptions): Q.Promise<number>;
        execSync(options: IExecOptions): IExecResult;
    }

}
declare module 'vso-task-lib/vsotask' {
    import fs = require('fs');
    import trm = require('vso-task-lib/toolrunner');
    export enum TaskResult {
        Succeeded = 0,
        Failed = 1,
    }
    export var _outStream: NodeJS.WritableStream;
    export var _errStream: NodeJS.WritableStream;
    export function _writeError(str: string): void;
    export function _writeLine(str: string): void;
    export function setStdStream(stdStream: any): void;
    export function setErrStream(errStream: any): void;
    export function setResult(result: TaskResult, message: string): void;
    export function handlerError(errMsg: string, continueOnError: boolean): void;
    export function exitOnCodeIf(code: any, condition: boolean): void;
    export function exit(code: number): void;
    export function getVariable(name: string): string;
    export function setVariable(name: string, val: string): void;
    export function getInput(name: string, required?: boolean): string;
    export function getBoolInput(name: string, required?: boolean): boolean;
    export function setEnvVar(name: string, val: string): void;
    export function getDelimitedInput(name: string, delim: string, required?: boolean): string[];
    export function filePathSupplied(name: string): boolean;
    export function getPathInput(name: string, required?: boolean, check?: boolean): string;
    export function getEndpointUrl(id: string, optional: boolean): string;
    export interface EndpointAuthorization {
        parameters: {
            [key: string]: string;
        };
        scheme: string;
    }
    export function getEndpointAuthorization(id: string, optional: boolean): EndpointAuthorization;
    export interface FsStats extends fs.Stats {
    }
    export function stats(path: string): FsStats;
    export function command(command: string, properties: any, message: string): void;
    export function warning(message: string): void;
    export function error(message: string): void;
    export function debug(message: string): void;
    export function cd(path: string): void;
    export function pushd(path: string): void;
    export function popd(): void;
    export function checkPath(p: string, name: string): void;
    export function mkdirP(p: any): boolean;
    export function which(tool: string, check?: boolean): string;
    export function cp(options: any, source: string, dest: string, continueOnError?: boolean): boolean;
    export function find(findPath: string): string[];
    export function rmRF(path: string, continueOnError?: boolean): boolean;
    export function glob(pattern: string): string[];
    export function globFirst(pattern: string): string;
    export function exec(tool: string, args: any, options?: trm.IExecOptions): Q.Promise<number>;
    export function execSync(tool: string, args: any, options?: trm.IExecOptions): trm.IExecResult;
    export function createToolRunner(tool: string): trm.ToolRunner;
    export function match(list: any, pattern: any, options: any): string[];
    export function matchFile(list: any, pattern: any, options: any): string[];
    export function filter(pattern: any, options: any): string[];
    export class TestPublisher {
        constructor(testRunner: any);
        testRunner: string;
        publish(resultFiles: any, mergeResults: any, platform: any, config: any): void;
    }

}
