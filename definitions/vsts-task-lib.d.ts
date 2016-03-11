/// <reference path="../definitions/node.d.ts" />
/// <reference path="../definitions/Q.d.ts" />
declare module 'vsts-task-lib/taskcommand' {
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
declare module 'vsts-task-lib/toolrunner' {
	/// <reference path="../definitions/node.d.ts" />
	/// <reference path="../definitions/Q.d.ts" />
	import Q = require('q');
	import events = require('events');
	/**
	 * Interface for exec options
	 *
	 * @param     cwd        optional working directory.  defaults to current
	 * @param     env        optional envvar dictionary.  defaults to current processes env
	 * @param     silent     optional.  defaults to false
	 * @param     failOnStdErr     optional.  whether to fail if output to stderr.  defaults to false
	 * @param     ignoreReturnCode     optional.  defaults to failing on non zero.  ignore will not fail leaving it up to the caller
	 */
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
	/**
	 * Interface for exec results returned from synchronous exec functions
	 *
	 * @param     stdout      standard output
	 * @param     stderr      error output
	 * @param     code        return code
	 * @param     error       Error on failure
	 */
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
	    /**
	     * Add arguments
	     * Accepts a full string command line and a string array as well
	     * With literal=false, will handle double quoted args. E.g. val='"arg one" two -z', args[]=['arg one', 'two', '-z']
	     * With literal=true, will put input direct into args. E.g. val='/bin/working folder', args[]=['/bin/working folder']
	     *
	     * @param     val        string cmdline or array of strings
	     * @param     literal    optional literal flag, if val is a string, add the original val to arguments when literal is true
	     * @returns   void
	     */
	    arg(val: any, literal?: boolean): void;
	    /**
	     * Add path argument
	     * Add path string to argument, path string should not contain double quoted
	     * This will call arg(val, literal?) with literal equal 'true'
	     *
	     * @param     val     path argument string
	     * @returns   void
	     */
	    pathArg(val: string): void;
	    /**
	     * Add argument(s) if a condition is met
	     * Wraps arg().  See arg for details
	     *
	     * @param     condition     boolean condition
	     * @param     val     string cmdline or array of strings
	     * @returns   void
	     */
	    argIf(condition: any, val: any): void;
	    /**
	     * Exec a tool.
	     * Output will be streamed to the live console.
	     * Returns promise with return code
	     *
	     * @param     tool     path to tool to exec
	     * @param     options  optional exec options.  See IExecOptions
	     * @returns   number
	     */
	    exec(options?: IExecOptions): Q.Promise<number>;
	    /**
	     * Exec a tool synchronously.
	     * Output will be *not* be streamed to the live console.  It will be returned after execution is complete.
	     * Appropriate for short running tools
	     * Returns IExecResult with output and return code
	     *
	     * @param     tool     path to tool to exec
	     * @param     options  optionalexec options.  See IExecOptions
	     * @returns   IExecResult
	     */
	    execSync(options?: IExecOptions): IExecResult;
	}

}
declare module 'vsts-task-lib/task' {
	/// <reference path="../definitions/node.d.ts" />
	/// <reference path="../definitions/Q.d.ts" />
	/// <reference path="../definitions/shelljs.d.ts" />
	/// <reference path="../definitions/minimatch.d.ts" />
	/// <reference path="../definitions/glob.d.ts" />
	import Q = require('q');
	import fs = require('fs');
	import trm = require('vsts-task-lib/toolrunner');
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
	/**
	 * Sets the result of the task.
	 * If the result is Failed (1), then execution will halt.
	 *
	 * @param result    TaskResult enum of Success or Failed.  If the result is Failed (1), then execution will halt.
	 * @param messages  A message which will be logged and added as an issue if an failed
	 * @returns         void
	 */
	export function setResult(result: TaskResult, message: string): void;
	export function handlerError(errMsg: string, continueOnError: boolean): void;
	export function exitOnCodeIf(code: number, condition: boolean): void;
	export function exit(code: number): void;
	/**
	 * Sets the location of the resources json.  This is typically the task.json file.
	 * Call once at the beginning of the script before any calls to loc.
	 *
	 * @param     path      Full path to the json.
	 * @returns   void
	 */
	export function setResourcePath(path: string): void;
	/**
	 * Gets the localized string from the json resource file.  Optionally formats with additional params.
	 *
	 * @param     key      key of the resources string in the resource file
	 * @param     param    additional params for formatting the string
	 * @returns   string
	 */
	export function loc(key: string, ...param: any[]): string;
	/**
	 * Gets a variables value which is defined on the build definition or set at runtime.
	 *
	 * @param     name     name of the variable to get
	 * @returns   string
	 */
	export function getVariable(name: string): string;
	/**
	 * Sets a variables which will be available to subsequent tasks as well.
	 *
	 * @param     name     name of the variable to set
	 * @param     val     value to set
	 * @returns   void
	 */
	export function setVariable(name: string, val: string): void;
	/**
	 * Gets the value of an input.  The value is also trimmed.
	 * If required is true and the value is not set, the task will fail with an error.  Execution halts.
	 *
	 * @param     name     name of the input to get
	 * @param     required whether input is required.  optional, defaults to false
	 * @returns   string
	 */
	export function getInput(name: string, required?: boolean): string;
	/**
	 * Gets the value of an input and converts to a bool.  Convenience.
	 * If required is true and the value is not set, the task will fail with an error.  Execution halts.
	 *
	 * @param     name     name of the bool input to get
	 * @param     required whether input is required.  optional, defaults to false
	 * @returns   string
	 */
	export function getBoolInput(name: string, required?: boolean): boolean;
	export function setEnvVar(name: string, val: string): void;
	/**
	 * Gets the value of an input and splits the values by a delimiter (space, comma, etc...)
	 * Useful for splitting an input with simple list of items like targets
	 * IMPORTANT: Do not use for splitting additional args!  Instead use arg() - it will split and handle
	 * If required is true and the value is not set, the task will fail with an error.  Execution halts.
	 *
	 * @param     name     name of the input to get
	 * @param     delim     delimiter to split on
	 * @param     required whether input is required.  optional, defaults to false
	 * @returns   string[]
	 */
	export function getDelimitedInput(name: string, delim: string, required?: boolean): string[];
	/**
	 * Checks whether a path inputs value was supplied by the user
	 * File paths are relative with a picker, so an empty path is the root of the repo.
	 * Useful if you need to condition work (like append an arg) if a value was supplied
	 *
	 * @param     name      name of the path input to check
	 * @returns   boolean
	 */
	export function filePathSupplied(name: string): boolean;
	/**
	 * Gets the value of a path input
	 * It will be quoted for you if it isn't already and contains spaces
	 * If required is true and the value is not set, the task will fail with an error.  Execution halts.
	 * If check is true and the path does not exist, the task will fail with an error.  Execution halts.
	 *
	 * @param     name      name of the input to get
	 * @param     required  whether input is required.  optional, defaults to false
	 * @param     check     whether path is checked.  optional, defaults to false
	 * @returns   string
	 */
	export function getPathInput(name: string, required?: boolean, check?: boolean): string;
	/**
	 * Gets the url for a service endpoint
	 * If the url was not set and is not optional, the task will fail with an error message. Execution will halt.
	 *
	 * @param     id        name of the service endpoint
	 * @param     optional  whether the url is optional
	 * @returns   string
	 */
	export function getEndpointUrl(id: string, optional: boolean): string;
	/**
	 * Interface for EndpointAuthorization
	 * Contains a schema and a string/string dictionary of auth data
	 *
	 * @param     parameters        string string dictionary of auth data
	 * @param     scheme            auth scheme such as OAuth or username/password etc...
	 */
	export interface EndpointAuthorization {
	    parameters: {
	        [key: string]: string;
	    };
	    scheme: string;
	}
	/**
	 * Gets the authorization details for a service endpoint
	 * If the authorization was not set and is not optional, the task will fail with an error message. Execution will halt.
	 *
	 * @param     id        name of the service endpoint
	 * @param     optional  whether the url is optional
	 * @returns   string
	 */
	export function getEndpointAuthorization(id: string, optional: boolean): EndpointAuthorization;
	export function command(command: string, properties: any, message: string): void;
	export function warning(message: string): void;
	export function error(message: string): void;
	export function debug(message: string): void;
	export interface FsStats extends fs.Stats {
	}
	/**
	 * Get's stat on a path.
	 * Useful for checking whether a file or directory.  Also getting created, modified and accessed time.
	 * see [fs.stat](https://nodejs.org/api/fs.html#fs_class_fs_stats)
	 *
	 * @param     path      path to check
	 * @returns   fsStat
	 */
	export function stats(path: string): FsStats;
	/**
	 * Returns whether a path exists.
	 *
	 * @param     path      path to check
	 * @returns   boolean
	 */
	export function exist(path: string): boolean;
	/**
	 * Checks whether a path exists.
	 * If the path does not exist, the task will fail with an error message. Execution will halt.
	 *
	 * @param     p         path to check
	 * @param     name      name only used in error message to identify the path
	 * @returns   void
	 */
	export function checkPath(p: string, name: string): void;
	/**
	 * Change working directory.
	 *
	 * @param     path      new working directory path
	 * @returns   void
	 */
	export function cd(path: string): void;
	/**
	 * Change working directory and push it on the stack
	 *
	 * @param     path      new working directory path
	 * @returns   void
	 */
	export function pushd(path: string): void;
	/**
	 * Change working directory back to previously pushed directory
	 *
	 * @returns   void
	 */
	export function popd(): void;
	/**
	 * Make a directory.  Creates the full path with folders in between
	 * Returns whether it was successful or not
	 *
	 * @param     p       path to create
	 * @returns   boolean
	 */
	export function mkdirP(p: any): boolean;
	/**
	 * Returns path of a tool had the tool actually been invoked.  Resolves via paths.
	 * If you check and the tool does not exist, the task will fail with an error message and halt execution.
	 *
	 * @param     tool       name of the tool
	 * @param     check      whether to check if tool exists
	 * @returns   string
	 */
	export function which(tool: string, check?: boolean): string;
	/**
	 * Returns path of a tool had the tool actually been invoked.  Resolves via paths.
	 * If you check and the tool does not exist, the task will fail with an error message and halt execution.
	 * Returns whether the copy was successful
	 *
	 * @param     options    string -r, -f or -rf for recursive and force
	 * @param     source     source path
	 * @param     dest       destination path
	 * @param     continueOnError optional. whether to continue on error
	 * @returns   boolean
	 */
	export function cp(options: any, source: string, dest: string, continueOnError?: boolean): boolean;
	/**
	 * Moves a path.
	 * Returns whether the copy was successful
	 *
	 * @param     source     source path
	 * @param     dest       destination path
	 * @param     force      whether to force and overwrite
	 * @param     continueOnError optional. whether to continue on error
	 * @returns   boolean
	 */
	export function mv(source: string, dest: string, force: boolean, continueOnError?: boolean): boolean;
	/**
	 * Find all files under a give path
	 * Returns an array of full paths
	 *
	 * @param     findPath     path to find files under
	 * @returns   string[]
	 */
	export function find(findPath: string): string[];
	/**
	 * Remove a path recursively with force
	 * Returns whether it succeeds
	 *
	 * @param     path     path to remove
	 * @param     continueOnError optional. whether to continue on error
	 * @returns   string[]
	 */
	export function rmRF(path: string, continueOnError?: boolean): boolean;
	export function glob(pattern: string): string[];
	export function globFirst(pattern: string): string;
	/**
	 * Exec a tool.  Convenience wrapper over ToolRunner to exec with args in one call.
	 * Output will be streamed to the live console.
	 * Returns promise with return code
	 *
	 * @param     tool     path to tool to exec
	 * @param     args     an arg string or array of args
	 * @param     options  optional exec options.  See IExecOptions
	 * @returns   number
	 */
	export function exec(tool: string, args: any, options?: trm.IExecOptions): Q.Promise<number>;
	/**
	 * Exec a tool synchronously.  Convenience wrapper over ToolRunner to execSync with args in one call.
	 * Output will be *not* be streamed to the live console.  It will be returned after execution is complete.
	 * Appropriate for short running tools
	 * Returns IExecResult with output and return code
	 *
	 * @param     tool     path to tool to exec
	 * @param     args     an arg string or array of args
	 * @param     options  optionalexec options.  See IExecOptions
	 * @returns   IExecResult
	 */
	export function execSync(tool: string, args: any, options?: trm.IExecOptions): trm.IExecResult;
	/**
	 * Convenience factory to create a ToolRunner.
	 *
	 * @param     tool     path to tool to exec
	 * @returns   ToolRunner
	 */
	export function createToolRunner(tool: string): trm.ToolRunner;
	export function match(list: any, pattern: any, options: any): string[];
	export function filter(pattern: any, options: any): (element: string, indexed: number, array: string[]) => boolean;
	export class TestPublisher {
	    constructor(testRunner: any);
	    testRunner: string;
	    publish(resultFiles: any, mergeResults: any, platform: any, config: any, runTitle: any, publishRunAttachments: any): void;
	}
	export class CodeCoveragePublisher {
	    constructor();
	    publish(codeCoverageTool: any, summaryFileLocation: any, reportDirectory: any, additionalCodeCoverageFiles: any): void;
	}

}
