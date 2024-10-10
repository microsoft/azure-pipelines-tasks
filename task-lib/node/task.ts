import Q = require('q');
import shell = require('shelljs');
import childProcess = require('child_process');
import fs = require('fs');
import path = require('path');
import os = require('os');
import minimatch = require('minimatch');
import im = require('./internal');
import tcm = require('./taskcommand');
import trm = require('./toolrunner');
import semver = require('semver');

export enum TaskResult {
    Succeeded = 0,
    SucceededWithIssues = 1,
    Failed = 2,
    Cancelled = 3,
    Skipped = 4
}

export enum TaskState {
    Unknown = 0,
    Initialized = 1,
    InProgress = 2,
    Completed = 3
}

export enum IssueType {
    Error,
    Warning
}

export enum ArtifactType {
    Container,
    FilePath,
    VersionControl,
    GitRef,
    TfvcLabel
}

export enum FieldType {
    AuthParameter,
    DataParameter,
    Url
}

export const IssueSource = im.IssueSource;

/** Platforms supported by our build agent */
export enum Platform {
    Windows,
    MacOS,
    Linux
}

export enum AgentHostedMode {
    Unknown,
    SelfHosted,
    MsHosted
}

//-----------------------------------------------------
// General Helpers
//-----------------------------------------------------
export const setStdStream = im._setStdStream;
export const setErrStream = im._setErrStream;

//-----------------------------------------------------
// Results
//-----------------------------------------------------

/**
 * Sets the result of the task.
 * Execution will continue.
 * If not set, task will be Succeeded.
 * If multiple calls are made to setResult the most pessimistic call wins (Failed) regardless of the order of calls.
 *
 * @param result    TaskResult enum of Succeeded, SucceededWithIssues, Failed, Cancelled or Skipped.
 * @param message   A message which will be logged as an error issue if the result is Failed.
 * @param done      Optional. Instructs the agent the task is done. This is helpful when child processes
 *                  may still be running and prevent node from fully exiting. This argument is supported
 *                  from agent version 2.142.0 or higher (otherwise will no-op).
 * @returns         void
 */
export function setResult(result: TaskResult.Succeeded, message?: string, done?: boolean): void;
export function setResult(result: Exclude<TaskResult, 'Succeeded'>, message: string, done?: boolean): void;
export function setResult(result: TaskResult, message: string, done?: boolean): void {
    debug('task result: ' + TaskResult[result]);

    // add an error issue
    if (result == TaskResult.Failed && message) {
        error(message, IssueSource.TaskInternal);
    }
    else if (result == TaskResult.SucceededWithIssues && message) {
        warning(message, IssueSource.TaskInternal);
    }

    // task.complete
    var properties = { 'result': TaskResult[result] };
    if (done) {
        properties['done'] = 'true';
    }

    command('task.complete', properties, message);
}

/**
 * Sets the result of the task with sanitized message.
 *
 * @param result    TaskResult enum of Succeeded, SucceededWithIssues, Failed, Cancelled or Skipped.
 * @param message   A message which will be logged as an error issue if the result is Failed. Message will be truncated 
 *                  before first occurence of wellknown sensitive keyword.
 * @param done      Optional. Instructs the agent the task is done. This is helpful when child processes
 *                  may still be running and prevent node from fully exiting. This argument is supported
 *                  from agent version 2.142.0 or higher (otherwise will no-op).
 * @returns         void
 */

export function setSanitizedResult(result: TaskResult, message: string, done?: boolean): void {
    const pattern = /password|key|secret|bearer|authorization|token|pat/i;
    const sanitizedMessage = im._truncateBeforeSensitiveKeyword(message, pattern);
    setResult(result, sanitizedMessage, done);
}

//
// Catching all exceptions
//
process.on('uncaughtException', (err: Error) => {
    if (!im.isSigPipeError(err)) {
        setResult(TaskResult.Failed, loc('LIB_UnhandledEx', err.message));
        error(String(err.stack), im.IssueSource.TaskInternal);
    }
});

//
// Catching unhandled rejections from promises and rethrowing them as exceptions
// For example, a promise that is rejected but not handled by a .catch() handler in node 10 
// doesn't cause an uncaughtException but causes in Node 16.
// For types definitions(Error | Any) see https://nodejs.org/docs/latest-v16.x/api/process.html#event-unhandledrejection
//
process.on('unhandledRejection', (reason: Error | any) => {
    if (reason instanceof Error) {
        throw reason;
    } else {
        throw new Error(reason);
    }
});

//-----------------------------------------------------
// Loc Helpers
//-----------------------------------------------------

export const setResourcePath = im._setResourcePath;
export const loc = im._loc;

//-----------------------------------------------------
// Input Helpers
//-----------------------------------------------------

export const getVariable = im._getVariable;

/**
 * Asserts the agent version is at least the specified minimum.
 *
 * @param    minimum    minimum version version - must be 2.104.1 or higher
 */
export function assertAgent(minimum: string): void {
    if (semver.lt(minimum, '2.104.1')) {
        throw new Error('assertAgent() requires the parameter to be 2.104.1 or higher');
    }

    let agent = getVariable('Agent.Version');
    if (agent && semver.lt(agent, minimum)) {
        throw new Error(`Agent version ${minimum} or higher is required`);
    }
}

/**
 * Gets a snapshot of the current state of all job variables available to the task.
 * Requires a 2.104.1 agent or higher for full functionality.
 *
 * Limitations on an agent prior to 2.104.1:
 *  1) The return value does not include all public variables. Only public variables
 *     that have been added using setVariable are returned.
 *  2) The name returned for each secret variable is the formatted environment variable
 *     name, not the actual variable name (unless it was set explicitly at runtime using
 *     setVariable).
 *
 * @returns VariableInfo[]
 */
export function getVariables(): VariableInfo[] {
    return Object.keys(im._knownVariableMap)
        .map((key: string) => {
            let info: im._KnownVariableInfo = im._knownVariableMap[key];
            return <VariableInfo>{ name: info.name, value: getVariable(info.name), secret: info.secret };
        });
}

/**
 * Sets a variable which will be available to subsequent tasks as well.
 *
 * @param     name     name of the variable to set
 * @param     val      value to set
 * @param     secret   whether variable is secret.  Multi-line secrets are not allowed.  Optional, defaults to false
 * @param     isOutput whether variable is an output variable.  Optional, defaults to false
 * @returns   void
 */
export function setVariable(name: string, val: string, secret: boolean = false, isOutput: boolean = false): void {
    // once a secret always a secret
    let key: string = im._getVariableKey(name);
    if (im._knownVariableMap.hasOwnProperty(key)) {
        secret = secret || im._knownVariableMap[key].secret;
    }

    // store the value
    let varValue = val || '';
    debug('set ' + name + '=' + (secret && varValue ? '********' : varValue));
    if (secret) {
        if (varValue && varValue.match(/\r|\n/) && `${process.env['SYSTEM_UNSAFEALLOWMULTILINESECRET']}`.toUpperCase() != 'TRUE') {
            throw new Error(loc('LIB_MultilineSecret'));
        }

        im._vault.storeSecret('SECRET_' + key, varValue);
        delete process.env[key];
    } else {
        process.env[key] = varValue;
    }

    // store the metadata
    im._knownVariableMap[key] = <im._KnownVariableInfo>{ name: name, secret: secret };

    // write the setvariable command
    command('task.setvariable', { 'variable': name || '', isOutput: (isOutput || false).toString(), 'issecret': (secret || false).toString() }, varValue);
}

/**
 * Registers a value with the logger, so the value will be masked from the logs.  Multi-line secrets are not allowed.
 *
 * @param val value to register
 */
export function setSecret(val: string): void {
    if (val) {
        if (val.match(/\r|\n/) && `${process.env['SYSTEM_UNSAFEALLOWMULTILINESECRET']}`.toUpperCase() !== 'TRUE') {
            throw new Error(loc('LIB_MultilineSecret'));
        }
        command('task.setsecret', {}, val);
    }
}

/** Snapshot of a variable at the time when getVariables was called. */
export interface VariableInfo {
    name: string;
    value: string;
    secret: boolean;
}

/**
 * Gets the value of an input.
 * If required is true and the value is not set, it will throw.
 *
 * @param     name     name of the input to get
 * @param     required whether input is required.  optional, defaults to false
 * @returns   string
 */
export function getInput(name: string, required?: boolean): string | undefined {
    var inval = im._vault.retrieveSecret('INPUT_' + im._getVariableKey(name));

    if (required && !inval) {
        throw new Error(loc('LIB_InputRequired', name));
    }

    debug(name + '=' + inval);
    return inval;
}

/**
 * Gets the value of an input.
 * If the value is not set, it will throw.
 *
 * @param     name     name of the input to get
 * @returns   string
 */
export function getInputRequired(name: string): string {
    return getInput(name, true)!;
}

/**
 * Gets the value of an input and converts to a bool.  Convenience.
 * If required is true and the value is not set, it will throw.
 * If required is false and the value is not set, returns false.
 *
 * @param     name     name of the bool input to get
 * @param     required whether input is required.  optional, defaults to false
 * @returns   boolean
 */
export function getBoolInput(name: string, required?: boolean): boolean {
    return (getInput(name, required) || '').toUpperCase() == "TRUE";
}

/**
 * Gets the value of an feature flag and converts to a bool.
 * @IMPORTANT This method is only for internal Microsoft development. Do not use it for external tasks.
 * @param     name     name of the feature flag to get.
 * @param     defaultValue default value of the feature flag in case it's not found in env. (optional. Default value = false)
 * @returns   boolean
 * @deprecated Don't use this for new development. Use getPipelineFeature instead.
 */
export function getBoolFeatureFlag(ffName: string, defaultValue: boolean = false): boolean {
    const ffValue = process.env[ffName];

    if (!ffValue) {
        debug(`Feature flag ${ffName} not found. Returning ${defaultValue} as default.`);
        return defaultValue;
    }

    debug(`Feature flag ${ffName} = ${ffValue}`);

    return ffValue.toLowerCase() === "true";
}

/**
 * Gets the value of an task feature and converts to a bool.
 * @IMPORTANT This method is only for internal Microsoft development. Do not use it for external tasks.
 * @param     name     name of the feature to get.
 * @returns   boolean
 */
export function getPipelineFeature(featureName: string): boolean {
    const variableName = im._getVariableKey(`DistributedTask.Tasks.${featureName}`);
    const featureValue = process.env[variableName];

    if (!featureValue) {
        debug(`Feature '${featureName}' not found. Returning false as default.`);
        return false;
    }

    const boolValue = featureValue.toLowerCase() === "true";

    debug(`Feature '${featureName}' = '${featureValue}'. Processed as '${boolValue}'.`);

    return boolValue;
}

/**
 * Gets the value of an input and splits the value using a delimiter (space, comma, etc).
 * Empty values are removed.  This function is useful for splitting an input containing a simple
 * list of items - such as build targets.
 * IMPORTANT: Do not use this function for splitting additional args!  Instead use argString(), which
 * follows normal argument splitting rules and handles values encapsulated by quotes.
 * If required is true and the value is not set, it will throw.
 *
 * @param     name     name of the input to get
 * @param     delim    delimiter to split on
 * @param     required whether input is required.  optional, defaults to false
 * @returns   string[]
 */
export function getDelimitedInput(name: string, delim: string | RegExp, required?: boolean): string[] {
    let inputVal = getInput(name, required);
    if (!inputVal) {
        return [];
    }

    let result: string[] = [];
    inputVal.split(delim).forEach((x: string) => {
        if (x) {
            result.push(x);
        }
    });

    return result;
}

/**
 * Checks whether a path inputs value was supplied by the user
 * File paths are relative with a picker, so an empty path is the root of the repo.
 * Useful if you need to condition work (like append an arg) if a value was supplied
 *
 * @param     name      name of the path input to check
 * @returns   boolean
 */
export function filePathSupplied(name: string): boolean {
    // normalize paths
    var pathValue = this.resolve(this.getPathInput(name) || '');
    var repoRoot = this.resolve(getVariable('build.sourcesDirectory') || getVariable('system.defaultWorkingDirectory') || '');

    var supplied = pathValue !== repoRoot;
    debug(name + 'path supplied :' + supplied);
    return supplied;
}

/**
 * Gets the value of a path input
 * It will be quoted for you if it isn't already and contains spaces
 * If required is true and the value is not set, it will throw.
 * If check is true and the path does not exist, it will throw.
 *
 * @param     name      name of the input to get
 * @param     required  whether input is required.  optional, defaults to false
 * @param     check     whether path is checked.  optional, defaults to false
 * @returns   string
 */
export function getPathInput(name: string, required?: boolean, check?: boolean): string | undefined {
    var inval = getInput(name, required);
    if (inval) {
        if (check) {
            checkPath(inval, name);
        }
    }

    return inval;
}

/**
 * Gets the value of a path input
 * It will be quoted for you if it isn't already and contains spaces
 * If the value is not set, it will throw.
 * If check is true and the path does not exist, it will throw.
 *
 * @param     name      name of the input to get
 * @param     check     whether path is checked.  optional, defaults to false
 * @returns   string
 */
export function getPathInputRequired(name: string, check?: boolean): string {
    return getPathInput(name, true, check)!;
}

//-----------------------------------------------------
// Endpoint Helpers
//-----------------------------------------------------

/**
 * Gets the url for a service endpoint
 * If the url was not set and is not optional, it will throw.
 *
 * @param     id        name of the service endpoint
 * @param     optional  whether the url is optional
 * @returns   string
 */
export function getEndpointUrl(id: string, optional: boolean): string | undefined {
    var urlval = process.env['ENDPOINT_URL_' + id];

    if (!optional && !urlval) {
        throw new Error(loc('LIB_EndpointNotExist', id));
    }

    debug(id + '=' + urlval);
    return urlval;
}

/**
 * Gets the url for a service endpoint
 * If the url was not set, it will throw.
 *
 * @param     id        name of the service endpoint
 * @returns   string
 */
export function getEndpointUrlRequired(id: string): string {
    return getEndpointUrl(id, false)!;
}

/*
 * Gets the endpoint data parameter value with specified key for a service endpoint
 * If the endpoint data parameter was not set and is not optional, it will throw.
 *
 * @param id name of the service endpoint
 * @param key of the parameter
 * @param optional whether the endpoint data is optional
 * @returns {string} value of the endpoint data parameter
 */
export function getEndpointDataParameter(id: string, key: string, optional: boolean): string | undefined {
    var dataParamVal = process.env['ENDPOINT_DATA_' + id + '_' + key.toUpperCase()];

    if (!optional && !dataParamVal) {
        throw new Error(loc('LIB_EndpointDataNotExist', id, key));
    }

    debug(id + ' data ' + key + ' = ' + dataParamVal);
    return dataParamVal;
}

/*
 * Gets the endpoint data parameter value with specified key for a service endpoint
 * If the endpoint data parameter was not set, it will throw.
 *
 * @param id name of the service endpoint
 * @param key of the parameter
 * @returns {string} value of the endpoint data parameter
 */
export function getEndpointDataParameterRequired(id: string, key: string): string {
    return getEndpointDataParameter(id, key, false)!;
}

/**
 * Gets the endpoint authorization scheme for a service endpoint
 * If the endpoint authorization scheme is not set and is not optional, it will throw.
 *
 * @param id name of the service endpoint
 * @param optional whether the endpoint authorization scheme is optional
 * @returns {string} value of the endpoint authorization scheme
 */
export function getEndpointAuthorizationScheme(id: string, optional: boolean): string | undefined {
    var authScheme = im._vault.retrieveSecret('ENDPOINT_AUTH_SCHEME_' + id);

    if (!optional && !authScheme) {
        throw new Error(loc('LIB_EndpointAuthNotExist', id));
    }

    debug(id + ' auth scheme = ' + authScheme);
    return authScheme;
}

/**
 * Gets the endpoint authorization scheme for a service endpoint
 * If the endpoint authorization scheme is not set, it will throw.
 *
 * @param id name of the service endpoint
 * @returns {string} value of the endpoint authorization scheme
 */
export function getEndpointAuthorizationSchemeRequired(id: string): string {
    return getEndpointAuthorizationScheme(id, false)!;
}

/**
 * Gets the endpoint authorization parameter value for a service endpoint with specified key
 * If the endpoint authorization parameter is not set and is not optional, it will throw.
 *
 * @param id name of the service endpoint
 * @param key key to find the endpoint authorization parameter
 * @param optional optional whether the endpoint authorization scheme is optional
 * @returns {string} value of the endpoint authorization parameter value
 */
export function getEndpointAuthorizationParameter(id: string, key: string, optional: boolean): string | undefined {
    var authParam = im._vault.retrieveSecret('ENDPOINT_AUTH_PARAMETER_' + id + '_' + key.toUpperCase());

    if (!optional && !authParam) {
        throw new Error(loc('LIB_EndpointAuthNotExist', id));
    }

    debug(id + ' auth param ' + key + ' = ' + authParam);
    return authParam;
}

/**
 * Gets the endpoint authorization parameter value for a service endpoint with specified key
 * If the endpoint authorization parameter is not set, it will throw.
 *
 * @param id name of the service endpoint
 * @param key key to find the endpoint authorization parameter
 * @returns {string} value of the endpoint authorization parameter value
 */
export function getEndpointAuthorizationParameterRequired(id: string, key: string): string {
    return getEndpointAuthorizationParameter(id, key, false)!;
}

/**
 * Interface for EndpointAuthorization
 * Contains a schema and a string/string dictionary of auth data
 */
export interface EndpointAuthorization {
    /** dictionary of auth data */
    parameters: {
        [key: string]: string;
    };

    /** auth scheme such as OAuth or username/password etc... */
    scheme: string;
}

/**
 * Gets the authorization details for a service endpoint
 * If the authorization was not set and is not optional, it will set the task result to Failed.
 *
 * @param     id        name of the service endpoint
 * @param     optional  whether the url is optional
 * @returns   string
 */
export function getEndpointAuthorization(id: string, optional: boolean): EndpointAuthorization | undefined {
    var aval = im._vault.retrieveSecret('ENDPOINT_AUTH_' + id);

    if (!optional && !aval) {
        setResult(TaskResult.Failed, loc('LIB_EndpointAuthNotExist', id));
    }

    debug(id + ' exists ' + (!!aval));

    var auth: EndpointAuthorization | undefined;
    try {
        if (aval) {
            auth = <EndpointAuthorization>JSON.parse(aval);
        }
    }
    catch (err) {
        throw new Error(loc('LIB_InvalidEndpointAuth', aval));
    }

    return auth;
}

//-----------------------------------------------------
// SecureFile Helpers
//-----------------------------------------------------

/**
 * Gets the name for a secure file
 *
 * @param     id        secure file id
 * @returns   string
 */
export function getSecureFileName(id: string): string | undefined {
    var name = process.env['SECUREFILE_NAME_' + id];

    debug('secure file name for id ' + id + ' = ' + name);
    return name;
}

/**
  * Gets the secure file ticket that can be used to download the secure file contents
  *
  * @param id name of the secure file
  * @returns {string} secure file ticket
  */
export function getSecureFileTicket(id: string): string | undefined {
    var ticket = im._vault.retrieveSecret('SECUREFILE_TICKET_' + id);

    debug('secure file ticket for id ' + id + ' = ' + ticket);
    return ticket;
}

//-----------------------------------------------------
// Task Variable Helpers
//-----------------------------------------------------
/**
 * Gets a variable value that is set by previous step from the same wrapper task.
 * Requires a 2.115.0 agent or higher.
 *
 * @param     name     name of the variable to get
 * @returns   string
 */
export function getTaskVariable(name: string): string | undefined {
    assertAgent('2.115.0');
    var inval = im._vault.retrieveSecret('VSTS_TASKVARIABLE_' + im._getVariableKey(name));
    if (inval) {
        inval = inval.trim();
    }

    debug('task variable: ' + name + '=' + inval);
    return inval;
}

/**
 * Sets a task variable which will only be available to subsequent steps belong to the same wrapper task.
 * Requires a 2.115.0 agent or higher.
 *
 * @param     name    name of the variable to set
 * @param     val     value to set
 * @param     secret  whether variable is secret.  optional, defaults to false
 * @returns   void
 */
export function setTaskVariable(name: string, val: string, secret: boolean = false): void {
    assertAgent('2.115.0');
    let key: string = im._getVariableKey(name);

    // store the value
    let varValue = val || '';
    debug('set task variable: ' + name + '=' + (secret && varValue ? '********' : varValue));
    im._vault.storeSecret('VSTS_TASKVARIABLE_' + key, varValue);
    delete process.env[key];

    // write the command
    command('task.settaskvariable', { 'variable': name || '', 'issecret': (secret || false).toString() }, varValue);
}

//-----------------------------------------------------
// Cmd Helpers
//-----------------------------------------------------

export const command = im._command;
export const warning = im._warning;
export const error = im._error;
export const debug = im._debug;

//-----------------------------------------------------
// Disk Functions
//-----------------------------------------------------
function _checkShell(cmd: string, continueOnError?: boolean) {
    var se = shell.error();

    if (se) {
        debug(cmd + ' failed');
        var errMsg = loc('LIB_OperationFailed', cmd, se);
        debug(errMsg);

        if (!continueOnError) {
            throw new Error(errMsg);
        }
    }
}

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
export function stats(path: string): FsStats {
    return fs.statSync(path);
}

export const exist = im._exist;

export function writeFile(file: string, data: string | Buffer, options?: BufferEncoding | fs.WriteFileOptions) {
    if (typeof (options) === 'string') {
        fs.writeFileSync(file, data, { encoding: options as BufferEncoding });
    }
    else {
        fs.writeFileSync(file, data, options);
    }
}

/**
 * @deprecated Use `getPlatform`
 * Useful for determining the host operating system.
 * see [os.type](https://nodejs.org/api/os.html#os_os_type)
 *
 * @return      the name of the operating system
 */
export function osType(): string {
    return os.type();
}

/**
 * Determine the operating system the build agent is running on.
 * @returns {Platform}
 * @throws {Error} Platform is not supported by our agent
 */
export function getPlatform(): Platform {
    switch (process.platform) {
        case 'win32': return Platform.Windows;
        case 'darwin': return Platform.MacOS;
        case 'linux': return Platform.Linux;
        default: throw Error(loc('LIB_PlatformNotSupported', process.platform));
    }
}

/**
 * Resolves major version of Node.js engine used by the agent.
 * @returns {Number} Node's major version.
 */
export function getNodeMajorVersion(): Number {
    const version = process?.versions?.node;
    if (!version) {
        throw new Error(loc('LIB_UndefinedNodeVersion'));
    }

    const parts = version.split('.').map(Number);
    if (parts.length < 1) {
        return NaN;
    }

    return parts[0];
}

/**
 * Return hosted type of Agent
 * @returns {AgentHostedMode}
 */
export function getAgentMode(): AgentHostedMode {
    let agentCloudId = getVariable('Agent.CloudId');

    if (agentCloudId === undefined)
        return AgentHostedMode.Unknown;

    if (agentCloudId)
        return AgentHostedMode.MsHosted;

    return AgentHostedMode.SelfHosted;
}

/**
 * Returns the process's current working directory.
 * see [process.cwd](https://nodejs.org/api/process.html#process_process_cwd)
 *
 * @return      the path to the current working directory of the process
 */
export function cwd(): string {
    return process.cwd();
}

export const checkPath = im._checkPath;

/**
 * Change working directory.
 *
 * @param     path      new working directory path
 * @returns   void
 */
export function cd(path: string): void {
    if (path) {
        shell.cd(path);
        _checkShell('cd');
    }
}

/**
 * Change working directory and push it on the stack
 *
 * @param     path      new working directory path
 * @returns   void
 */
export function pushd(path: string): void {
    shell.pushd(path);
    _checkShell('pushd');
}

/**
 * Change working directory back to previously pushed directory
 *
 * @returns   void
 */
export function popd(): void {
    shell.popd();
    _checkShell('popd');
}

/**
 * Make a directory.  Creates the full path with folders in between
 * Will throw if it fails
 *
 * @param     p       path to create
 * @returns   void
 */
export function mkdirP(p: string): void {
    if (!p) {
        throw new Error(loc('LIB_ParameterIsRequired', 'p'));
    }

    // build a stack of directories to create
    let stack: string[] = [];
    let testDir: string = p;
    while (true) {
        // validate the loop is not out of control
        if (stack.length >= Number(process.env['TASKLIB_TEST_MKDIRP_FAILSAFE'] || 1000)) {
            // let the framework throw
            debug('loop is out of control');
            fs.mkdirSync(p);
            return;
        }

        debug(`testing directory '${testDir}'`);
        let stats: fs.Stats;
        try {
            stats = fs.statSync(testDir);
        } catch (err) {
            if (err.code == 'ENOENT') {
                // validate the directory is not the drive root
                let parentDir = path.dirname(testDir);
                if (testDir == parentDir) {
                    throw new Error(loc('LIB_MkdirFailedInvalidDriveRoot', p, testDir)); // Unable to create directory '{p}'. Root directory does not exist: '{testDir}'
                }

                // push the dir and test the parent
                stack.push(testDir);
                testDir = parentDir;
                continue;
            }
            else if (err.code == 'UNKNOWN') {
                throw new Error(loc('LIB_MkdirFailedInvalidShare', p, testDir)) // Unable to create directory '{p}'. Unable to verify the directory exists: '{testDir}'. If directory is a file share, please verify the share name is correct, the share is online, and the current process has permission to access the share.
            }
            else {
                throw err;
            }
        }

        if (!stats.isDirectory()) {
            throw new Error(loc('LIB_MkdirFailedFileExists', p, testDir)); // Unable to create directory '{p}'. Conflicting file exists: '{testDir}'
        }

        // testDir exists
        break;
    }

    // create each directory
    while (stack.length) {
        let dir = stack.pop()!; // non-null because `stack.length` was truthy
        debug(`mkdir '${dir}'`);
        try {
            fs.mkdirSync(dir);
        } catch (err) {
            throw new Error(loc('LIB_MkdirFailed', p, err.message)); // Unable to create directory '{p}'. {err.message}
        }
    }
}

/**
 * Resolves a sequence of paths or path segments into an absolute path.
 * Calls node.js path.resolve()
 * Allows L0 testing with consistent path formats on Mac/Linux and Windows in the mock implementation
 * @param pathSegments
 * @returns {string}
 */
export function resolve(...pathSegments: any[]): string {
    var absolutePath = path.resolve.apply(this, pathSegments);
    debug('Absolute path for pathSegments: ' + pathSegments + ' = ' + absolutePath);
    return absolutePath;
}

export const which = im._which;

/**
 * Returns array of files in the given path, or in current directory if no path provided.  See shelljs.ls
 * @param  {string}   options  Available options: -R (recursive), -A (all files, include files beginning with ., except for . and ..)
 * @param  {string[]} paths    Paths to search.
 * @return {string[]}          An array of files in the given path(s).
 */
export function ls(options: string, paths: string[]): string[] {
    if (options) {
        return shell.ls(options, paths);
    } else {
        return shell.ls(paths);
    }
}

/**
 * Copies a file or folder.
 *
 * @param     source     source path
 * @param     dest       destination path
 * @param     options    string -r, -f or -rf for recursive and force
 * @param     continueOnError optional. whether to continue on error
 * @param     retryCount optional. Retry count to copy the file. It might help to resolve intermittent issues e.g. with UNC target paths on a remote host.
 */
export function cp(source: string, dest: string, options?: string, continueOnError?: boolean, retryCount: number = 0): void {
    while (retryCount >= 0) {
        try {
            if (options) {
                shell.cp(options, source, dest);
            }
            else {
                shell.cp(source, dest);
            }

            _checkShell('cp', false);
            break;
        } catch (e) {
            if (retryCount <= 0) {
                if (continueOnError) {
                    warning(e, IssueSource.TaskInternal);
                    break;
                } else {
                    throw e;
                }
            } else {
                console.log(loc('LIB_CopyFileFailed', retryCount));
                retryCount--;
            }
        }
    }
}

/**
 * Moves a path.
 *
 * @param     source     source path
 * @param     dest       destination path
 * @param     options    string -f or -n for force and no clobber
 * @param     continueOnError optional. whether to continue on error
 */
export function mv(source: string, dest: string, options?: string, continueOnError?: boolean): void {
    if (options) {
        shell.mv(options, source, dest);
    }
    else {
        shell.mv(source, dest);
    }

    _checkShell('mv', continueOnError);
}

/**
 * Interface for FindOptions
 * Contains properties to control whether to follow symlinks
 */
export interface FindOptions {

    /**
     * When true, broken symbolic link will not cause an error.
     */
    allowBrokenSymbolicLinks: boolean,

    /**
     * Equivalent to the -H command line option. Indicates whether to traverse descendants if
     * the specified path is a symbolic link directory. Does not cause nested symbolic link
     * directories to be traversed.
     */
    followSpecifiedSymbolicLink: boolean;

    /**
     * Equivalent to the -L command line option. Indicates whether to traverse descendants of
     * symbolic link directories.
     */
    followSymbolicLinks: boolean;

    /**
     * When true, missing files will not cause an error and will be skipped.
     */
    skipMissingFiles?: boolean;
}

/**
 * Interface for RetryOptions
 *
 * Contains "continueOnError" and "retryCount" options.
 */
export interface RetryOptions {

    /**
     * If true, code still continues to execute when all retries failed.
     */
    continueOnError: boolean,

    /**
     * Number of retries.
     */
    retryCount: number
}

/**
 * Tries to execute a function a specified number of times.
 *
 * @param   func            a function to be executed.
 * @param   args            executed function arguments array.
 * @param   retryOptions    optional. Defaults to { continueOnError: false, retryCount: 0 }.
 * @returns the same as the usual function.
 */
export function retry(func: Function, args: any[], retryOptions: RetryOptions = { continueOnError: false, retryCount: 0 }): any {
    while (retryOptions.retryCount >= 0) {
        try {
            return func(...args);
        } catch (e) {
            if (retryOptions.retryCount <= 0) {
                if (retryOptions.continueOnError) {
                    warning(e, IssueSource.TaskInternal);
                    break;
                } else {
                    throw e;
                }
            } else {
                debug(`Attempt to execute function "${func?.name}" failed, retries left: ${retryOptions.retryCount}`);
                retryOptions.retryCount--;
            }
        }
    }
}

/**
 * Gets info about item stats.
 *
 * @param path                      a path to the item to be processed.
 * @param followSymbolicLink        indicates whether to traverse descendants of symbolic link directories.
 * @param allowBrokenSymbolicLinks  when true, broken symbolic link will not cause an error.
 * @returns fs.Stats
 */
function _getStats(path: string, followSymbolicLink: boolean, allowBrokenSymbolicLinks: boolean): fs.Stats {
    // stat returns info about the target of a symlink (or symlink chain),
    // lstat returns info about a symlink itself
    let stats: fs.Stats;

    if (followSymbolicLink) {
        try {
            // use stat (following symlinks)
            stats = fs.statSync(path);
        } catch (err) {
            if (err.code == 'ENOENT' && allowBrokenSymbolicLinks) {
                // fallback to lstat (broken symlinks allowed)
                stats = fs.lstatSync(path);
                debug(`  ${path} (broken symlink)`);
            } else {
                throw err;
            }
        }
    } else {
        // use lstat (not following symlinks)
        stats = fs.lstatSync(path);
    }

    return stats;
}

/**
 * Recursively finds all paths a given path. Returns an array of paths.
 *
 * @param     findPath  path to search
 * @param     options   optional. defaults to { followSymbolicLinks: true }. following soft links is generally appropriate unless deleting files.
 * @returns   string[]
 */
export function find(findPath: string, options?: FindOptions): string[] {
    if (!findPath) {
        debug('no path specified');
        return [];
    }

    // normalize the path, otherwise the first result is inconsistently formatted from the rest of the results
    // because path.join() performs normalization.
    findPath = path.normalize(findPath);

    // debug trace the parameters
    debug(`findPath: '${findPath}'`);
    options = options || _getDefaultFindOptions();
    _debugFindOptions(options)

    // return empty if not exists
    try {
        fs.lstatSync(findPath);
    }
    catch (err) {
        if (err.code == 'ENOENT') {
            debug('0 results')
            return [];
        }

        throw err;
    }

    try {
        let result: string[] = [];

        // push the first item
        let stack: _FindItem[] = [new _FindItem(findPath, 1)];
        let traversalChain: string[] = []; // used to detect cycles

        while (stack.length) {
            // pop the next item and push to the result array
            let item = stack.pop()!; // non-null because `stack.length` was truthy

            let stats: fs.Stats;
            try {
                // `item.path` equals `findPath` for the first item to be processed, when the `result` array is empty
                const isPathToSearch: boolean = !result.length;

                // following specified symlinks only if current path equals specified path
                const followSpecifiedSymbolicLink: boolean = options.followSpecifiedSymbolicLink && isPathToSearch;

                // following all symlinks or following symlink for the specified path
                const followSymbolicLink: boolean = options.followSymbolicLinks || followSpecifiedSymbolicLink;

                // stat the item. The stat info is used further below to determine whether to traverse deeper
                stats = _getStats(item.path, followSymbolicLink, options.allowBrokenSymbolicLinks);
            } catch (err) {
                if (err.code == 'ENOENT' && options.skipMissingFiles) {
                    warning(`No such file or directory: "${item.path}" - skipping.`, IssueSource.TaskInternal);
                    continue;
                }
                throw err;
            }
            result.push(item.path);

            // note, isDirectory() returns false for the lstat of a symlink
            if (stats.isDirectory()) {
                debug(`  ${item.path} (directory)`);

                if (options.followSymbolicLinks) {
                    // get the realpath
                    let realPath: string;
                    if (im._isUncPath(item.path)) {
                        // Sometimes there are spontaneous issues when working with unc-paths, so retries have been added for them.
                        realPath = retry(fs.realpathSync, [item.path], { continueOnError: false, retryCount: 5 });
                    } else {
                        realPath = fs.realpathSync(item.path);
                    }

                    // fixup the traversal chain to match the item level
                    while (traversalChain.length >= item.level) {
                        traversalChain.pop();
                    }

                    // test for a cycle
                    if (traversalChain.some((x: string) => x == realPath)) {
                        debug('    cycle detected');
                        continue;
                    }

                    // update the traversal chain
                    traversalChain.push(realPath);
                }

                // push the child items in reverse onto the stack
                let childLevel: number = item.level + 1;
                let childItems: _FindItem[] =
                    fs.readdirSync(item.path)
                        .map((childName: string) => new _FindItem(path.join(item.path, childName), childLevel));
                for (var i = childItems.length - 1; i >= 0; i--) {
                    stack.push(childItems[i]);
                }
            }
            else {
                debug(`  ${item.path} (file)`);
            }
        }

        debug(`${result.length} results`);
        return result;
    }
    catch (err) {
        throw new Error(loc('LIB_OperationFailed', 'find', err.message));
    }
}

class _FindItem {
    public path: string;
    public level: number;

    public constructor(path: string, level: number) {
        this.path = path;
        this.level = level;
    }
}

function _debugFindOptions(options: FindOptions): void {
    debug(`findOptions.allowBrokenSymbolicLinks: '${options.allowBrokenSymbolicLinks}'`);
    debug(`findOptions.followSpecifiedSymbolicLink: '${options.followSpecifiedSymbolicLink}'`);
    debug(`findOptions.followSymbolicLinks: '${options.followSymbolicLinks}'`);
    debug(`findOptions.skipMissingFiles: '${options.skipMissingFiles}'`);
}

function _getDefaultFindOptions(): FindOptions {
    return <FindOptions>{
        allowBrokenSymbolicLinks: false,
        followSpecifiedSymbolicLink: true,
        followSymbolicLinks: true,
        skipMissingFiles: false
    };
}

/**
 * Prefer tl.find() and tl.match() instead. This function is for backward compatibility
 * when porting tasks to Node from the PowerShell or PowerShell3 execution handler.
 *
 * @param    rootDirectory      path to root unrooted patterns with
 * @param    pattern            include and exclude patterns
 * @param    includeFiles       whether to include files in the result. defaults to true when includeFiles and includeDirectories are both false
 * @param    includeDirectories whether to include directories in the result
 * @returns  string[]
 */
export function legacyFindFiles(
    rootDirectory: string,
    pattern: string,
    includeFiles?: boolean,
    includeDirectories?: boolean): string[] {

    if (!pattern) {
        throw new Error('pattern parameter cannot be empty');
    }

    debug(`legacyFindFiles rootDirectory: '${rootDirectory}'`);
    debug(`pattern: '${pattern}'`);
    debug(`includeFiles: '${includeFiles}'`);
    debug(`includeDirectories: '${includeDirectories}'`);
    if (!includeFiles && !includeDirectories) {
        includeFiles = true;
    }

    // organize the patterns into include patterns and exclude patterns
    let includePatterns: string[] = [];
    let excludePatterns: RegExp[] = [];
    pattern = pattern.replace(/;;/g, '\0');
    for (let pat of pattern.split(';')) {
        if (!pat) {
            continue;
        }

        pat = pat.replace(/\0/g, ';');

        // determine whether include pattern and remove any include/exclude prefix.
        // include patterns start with +: or anything other than -:
        // exclude patterns start with -:
        let isIncludePattern: boolean;
        if (im._startsWith(pat, '+:')) {
            pat = pat.substring(2);
            isIncludePattern = true;
        }
        else if (im._startsWith(pat, '-:')) {
            pat = pat.substring(2);
            isIncludePattern = false;
        }
        else {
            isIncludePattern = true;
        }

        // validate pattern does not end with a slash
        if (im._endsWith(pat, '/') || (process.platform == 'win32' && im._endsWith(pat, '\\'))) {
            throw new Error(loc('LIB_InvalidPattern', pat));
        }

        // root the pattern
        if (rootDirectory && !path.isAbsolute(pat)) {
            pat = path.join(rootDirectory, pat);

            // remove trailing slash sometimes added by path.join() on Windows, e.g.
            //      path.join('\\\\hello', 'world') => '\\\\hello\\world\\'
            //      path.join('//hello', 'world') => '\\\\hello\\world\\'
            if (im._endsWith(pat, '\\')) {
                pat = pat.substring(0, pat.length - 1);
            }
        }

        if (isIncludePattern) {
            includePatterns.push(pat);
        }
        else {
            excludePatterns.push(im._legacyFindFiles_convertPatternToRegExp(pat));
        }
    }

    // find and apply patterns
    let count = 0;
    let result: string[] = _legacyFindFiles_getMatchingItems(includePatterns, excludePatterns, !!includeFiles, !!includeDirectories);
    debug('all matches:');
    for (let resultItem of result) {
        debug(' ' + resultItem);
    }

    debug('total matched: ' + result.length);
    return result;
}


function _legacyFindFiles_getMatchingItems(
    includePatterns: string[],
    excludePatterns: RegExp[],
    includeFiles: boolean,
    includeDirectories: boolean) {

    debug('getMatchingItems()');
    for (let pattern of includePatterns) {
        debug(`includePattern: '${pattern}'`);
    }

    for (let pattern of excludePatterns) {
        debug(`excludePattern: ${pattern}`);
    }

    debug('includeFiles: ' + includeFiles);
    debug('includeDirectories: ' + includeDirectories);

    let allFiles = {} as { [k: string]: string };
    for (let pattern of includePatterns) {
        // determine the directory to search
        //
        // note, getDirectoryName removes redundant path separators
        let findPath: string;
        let starIndex = pattern.indexOf('*');
        let questionIndex = pattern.indexOf('?');
        if (starIndex < 0 && questionIndex < 0) {
            // if no wildcards are found, use the directory name portion of the path.
            // if there is no directory name (file name only in pattern or drive root),
            // this will return empty string.
            findPath = im._getDirectoryName(pattern);
        }
        else {
            // extract the directory prior to the first wildcard
            let index = Math.min(
                starIndex >= 0 ? starIndex : questionIndex,
                questionIndex >= 0 ? questionIndex : starIndex);
            findPath = im._getDirectoryName(pattern.substring(0, index));
        }

        // note, due to this short-circuit and the above usage of getDirectoryName, this
        // function has the same limitations regarding drive roots as the powershell
        // implementation.
        //
        // also note, since getDirectoryName eliminates slash redundancies, some additional
        // work may be required if removal of this limitation is attempted.
        if (!findPath) {
            continue;
        }

        let patternRegex: RegExp = im._legacyFindFiles_convertPatternToRegExp(pattern);

        // find files/directories
        let items = find(findPath, <FindOptions>{ followSymbolicLinks: true })
            .filter((item: string) => {
                if (includeFiles && includeDirectories) {
                    return true;
                }

                let isDir = fs.statSync(item).isDirectory();
                return (includeFiles && !isDir) || (includeDirectories && isDir);
            })
            .forEach((item: string) => {
                let normalizedPath = process.platform == 'win32' ? item.replace(/\\/g, '/') : item; // normalize separators
                // **/times/** will not match C:/fun/times because there isn't a trailing slash
                // so try both if including directories
                let alternatePath = `${normalizedPath}/`;   // potential bug: it looks like this will result in a false
                // positive if the item is a regular file and not a directory

                let isMatch = false;
                if (patternRegex.test(normalizedPath) || (includeDirectories && patternRegex.test(alternatePath))) {
                    isMatch = true;

                    // test whether the path should be excluded
                    for (let regex of excludePatterns) {
                        if (regex.test(normalizedPath) || (includeDirectories && regex.test(alternatePath))) {
                            isMatch = false;
                            break;
                        }
                    }
                }

                if (isMatch) {
                    allFiles[item] = item;
                }
            });
    }

    return Object.keys(allFiles).sort();
}

/**
 * Remove a path recursively with force
 *
 * @param     inputPath path to remove
 * @throws    when the file or directory exists but could not be deleted.
 */
export function rmRF(inputPath: string): void {
    debug('rm -rf ' + inputPath);

    if (getPlatform() == Platform.Windows) {
        // Node doesn't provide a delete operation, only an unlink function. This means that if the file is being used by another
        // program (e.g. antivirus), it won't be deleted. To address this, we shell out the work to rd/del.
        try {
            if (fs.statSync(inputPath).isDirectory()) {
                debug('removing directory ' + inputPath);
                childProcess.execSync(`rd /s /q "${inputPath}"`);
            }
            else {
                debug('removing file ' + inputPath);
                childProcess.execSync(`del /f /a "${inputPath}"`);
            }
        }
        catch (err) {
            // if you try to delete a file that doesn't exist, desired result is achieved
            // other errors are valid
            if (err.code != 'ENOENT') {
                throw new Error(loc('LIB_OperationFailed', 'rmRF', err.message));
            }
        }

        // Shelling out fails to remove a symlink folder with missing source, this unlink catches that
        try {
            fs.unlinkSync(inputPath);
        }
        catch (err) {
            // if you try to delete a file that doesn't exist, desired result is achieved
            // other errors are valid
            if (err.code != 'ENOENT') {
                throw new Error(loc('LIB_OperationFailed', 'rmRF', err.message));
            }
        }
    }
    else {
        // get the lstats in order to workaround a bug in shelljs@0.3.0 where symlinks
        // with missing targets are not handled correctly by "rm('-rf', path)"
        let lstats: fs.Stats;
        try {
            lstats = fs.lstatSync(inputPath);
        }
        catch (err) {
            // if you try to delete a file that doesn't exist, desired result is achieved
            // other errors are valid
            if (err.code == 'ENOENT') {
                return;
            }

            throw new Error(loc('LIB_OperationFailed', 'rmRF', err.message));
        }

        if (lstats.isDirectory()) {
            debug('removing directory');
            shell.rm('-rf', inputPath);
            let errMsg: string = shell.error();
            if (errMsg) {
                throw new Error(loc('LIB_OperationFailed', 'rmRF', errMsg));
            }

            return;
        }

        debug('removing file');
        try {
            fs.unlinkSync(inputPath);
        }
        catch (err) {
            throw new Error(loc('LIB_OperationFailed', 'rmRF', err.message));
        }
    }
}

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
export function execAsync(tool: string, args: any, options?: trm.IExecOptions): Promise<number> {
    let tr: trm.ToolRunner = this.tool(tool);
    if (args) {
        if (args instanceof Array) {
            tr.arg(args);
        }
        else if (typeof (args) === 'string') {
            tr.line(args)
        }
    }
    return tr.execAsync(options);
}

/**
 * Exec a tool.  Convenience wrapper over ToolRunner to exec with args in one call.
 * Output will be streamed to the live console.
 * Returns promise with return code
 *
 * @deprecated Use the {@link execAsync} method that returns a native Javascript Promise instead
 * @param     tool     path to tool to exec
 * @param     args     an arg string or array of args
 * @param     options  optional exec options.  See IExecOptions
 * @returns   number
 */
export function exec(tool: string, args: any, options?: trm.IExecOptions): Q.Promise<number> {
    let tr: trm.ToolRunner = this.tool(tool);
    if (args) {
        if (args instanceof Array) {
            tr.arg(args);
        }
        else if (typeof (args) === 'string') {
            tr.line(args)
        }
    }
    return tr.exec(options);
}

/**
 * Exec a tool synchronously.  Convenience wrapper over ToolRunner to execSync with args in one call.
 * Output will be *not* be streamed to the live console.  It will be returned after execution is complete.
 * Appropriate for short running tools
 * Returns IExecResult with output and return code
 *
 * @param     tool     path to tool to exec
 * @param     args     an arg string or array of args
 * @param     options  optional exec options.  See IExecSyncOptions
 * @returns   IExecSyncResult
 */
export function execSync(tool: string, args: string | string[], options?: trm.IExecSyncOptions): trm.IExecSyncResult {
    let tr: trm.ToolRunner = this.tool(tool);
    if (args) {
        if (args instanceof Array) {
            tr.arg(args);
        }
        else if (typeof (args) === 'string') {
            tr.line(args)
        }
    }

    return tr.execSync(options);
}

/**
 * Convenience factory to create a ToolRunner.
 *
 * @param     tool     path to tool to exec
 * @returns   ToolRunner
 */
export function tool(tool: string) {
    let tr: trm.ToolRunner = new trm.ToolRunner(tool);
    tr.on('debug', (message: string) => {
        debug(message);
    })

    return tr;
}

//-----------------------------------------------------
// Matching helpers
//-----------------------------------------------------

export interface MatchOptions {
    debug?: boolean;
    nobrace?: boolean;
    noglobstar?: boolean;
    dot?: boolean;
    noext?: boolean;
    nocase?: boolean;
    nonull?: boolean;
    matchBase?: boolean;
    nocomment?: boolean;
    nonegate?: boolean;
    flipNegate?: boolean;
}

/**
 * Applies glob patterns to a list of paths. Supports interleaved exclude patterns.
 *
 * @param  list         array of paths
 * @param  patterns     patterns to apply. supports interleaved exclude patterns.
 * @param  patternRoot  optional. default root to apply to unrooted patterns. not applied to basename-only patterns when matchBase:true.
 * @param  options      optional. defaults to { dot: true, nobrace: true, nocase: process.platform == 'win32' }.
 */
export function match(list: string[], patterns: string[] | string, patternRoot?: string, options?: MatchOptions): string[] {
    // trace parameters
    debug(`patternRoot: '${patternRoot}'`);
    options = options || _getDefaultMatchOptions(); // default match options
    _debugMatchOptions(options);

    // convert pattern to an array
    if (typeof patterns == 'string') {
        patterns = [patterns as string];
    }

    // hashtable to keep track of matches
    let map: { [item: string]: boolean } = {};

    let originalOptions = options;
    for (let pattern of patterns) {
        debug(`pattern: '${pattern}'`);

        // trim and skip empty
        pattern = (pattern || '').trim();
        if (!pattern) {
            debug('skipping empty pattern');
            continue;
        }

        // clone match options
        let options = im._cloneMatchOptions(originalOptions);

        // skip comments
        if (!options.nocomment && im._startsWith(pattern, '#')) {
            debug('skipping comment');
            continue;
        }

        // set nocomment - brace expansion could result in a leading '#'
        options.nocomment = true;

        // determine whether pattern is include or exclude
        let negateCount = 0;
        if (!options.nonegate) {
            while (pattern.charAt(negateCount) == '!') {
                negateCount++;
            }

            pattern = pattern.substring(negateCount); // trim leading '!'
            if (negateCount) {
                debug(`trimmed leading '!'. pattern: '${pattern}'`);
            }
        }

        let isIncludePattern = negateCount == 0 ||
            (negateCount % 2 == 0 && !options.flipNegate) ||
            (negateCount % 2 == 1 && options.flipNegate);

        // set nonegate - brace expansion could result in a leading '!'
        options.nonegate = true;
        options.flipNegate = false;

        // expand braces - required to accurately root patterns
        let expanded: string[];
        let preExpanded: string = pattern;
        if (options.nobrace) {
            expanded = [pattern];
        }
        else {
            // convert slashes on Windows before calling braceExpand(). unfortunately this means braces cannot
            // be escaped on Windows, this limitation is consistent with current limitations of minimatch (3.0.3).
            debug('expanding braces');
            let convertedPattern = process.platform == 'win32' ? pattern.replace(/\\/g, '/') : pattern;
            expanded = (minimatch as any).braceExpand(convertedPattern);
        }

        // set nobrace
        options.nobrace = true;

        for (let pattern of expanded) {
            if (expanded.length != 1 || pattern != preExpanded) {
                debug(`pattern: '${pattern}'`);
            }

            // trim and skip empty
            pattern = (pattern || '').trim();
            if (!pattern) {
                debug('skipping empty pattern');
                continue;
            }

            // root the pattern when all of the following conditions are true:
            if (patternRoot &&          // patternRoot supplied
                !im._isRooted(pattern) &&  // AND pattern not rooted
                // AND matchBase:false or not basename only
                (!options.matchBase || (process.platform == 'win32' ? pattern.replace(/\\/g, '/') : pattern).indexOf('/') >= 0)) {

                pattern = im._ensureRooted(patternRoot, pattern);
                debug(`rooted pattern: '${pattern}'`);
            }

            if (isIncludePattern) {
                // apply the pattern
                debug('applying include pattern against original list');
                let matchResults: string[] = minimatch.match(list, pattern, options);
                debug(matchResults.length + ' matches');

                // union the results
                for (let matchResult of matchResults) {
                    map[matchResult] = true;
                }
            }
            else {
                // apply the pattern
                debug('applying exclude pattern against original list');
                let matchResults: string[] = minimatch.match(list, pattern, options);
                debug(matchResults.length + ' matches');

                // substract the results
                for (let matchResult of matchResults) {
                    delete map[matchResult];
                }
            }
        }
    }

    // return a filtered version of the original list (preserves order and prevents duplication)
    let result: string[] = list.filter((item: string) => map.hasOwnProperty(item));
    debug(result.length + ' final results');
    return result;
}

/**
 * Filter to apply glob patterns
 *
 * @param  pattern  pattern to apply
 * @param  options  optional. defaults to { dot: true, nobrace: true, nocase: process.platform == 'win32' }.
 */
export function filter(pattern: string, options?: MatchOptions): (element: string, indexed: number, array: string[]) => boolean {
    options = options || _getDefaultMatchOptions();
    return minimatch.filter(pattern, options);
}

function _debugMatchOptions(options: MatchOptions): void {
    debug(`matchOptions.debug: '${options.debug}'`);
    debug(`matchOptions.nobrace: '${options.nobrace}'`);
    debug(`matchOptions.noglobstar: '${options.noglobstar}'`);
    debug(`matchOptions.dot: '${options.dot}'`);
    debug(`matchOptions.noext: '${options.noext}'`);
    debug(`matchOptions.nocase: '${options.nocase}'`);
    debug(`matchOptions.nonull: '${options.nonull}'`);
    debug(`matchOptions.matchBase: '${options.matchBase}'`);
    debug(`matchOptions.nocomment: '${options.nocomment}'`);
    debug(`matchOptions.nonegate: '${options.nonegate}'`);
    debug(`matchOptions.flipNegate: '${options.flipNegate}'`);
}

function _getDefaultMatchOptions(): MatchOptions {
    return <MatchOptions>{
        debug: false,
        nobrace: true,
        noglobstar: false,
        dot: true,
        noext: false,
        nocase: process.platform == 'win32',
        nonull: false,
        matchBase: false,
        nocomment: false,
        nonegate: false,
        flipNegate: false
    };
}

/**
 * Determines the find root from a list of patterns. Performs the find and then applies the glob patterns.
 * Supports interleaved exclude patterns. Unrooted patterns are rooted using defaultRoot, unless
 * matchOptions.matchBase is specified and the pattern is a basename only. For matchBase cases, the
 * defaultRoot is used as the find root.
 *
 * @param  defaultRoot   default path to root unrooted patterns. falls back to System.DefaultWorkingDirectory or process.cwd().
 * @param  patterns      pattern or array of patterns to apply
 * @param  findOptions   defaults to { followSymbolicLinks: true }. following soft links is generally appropriate unless deleting files.
 * @param  matchOptions  defaults to { dot: true, nobrace: true, nocase: process.platform == 'win32' }
 */
export function findMatch(defaultRoot: string, patterns: string[] | string, findOptions?: FindOptions, matchOptions?: MatchOptions): string[] {

    // apply defaults for parameters and trace
    defaultRoot = defaultRoot || this.getVariable('system.defaultWorkingDirectory') || process.cwd();
    debug(`defaultRoot: '${defaultRoot}'`);
    patterns = patterns || [];
    patterns = typeof patterns == 'string' ? [patterns] as string[] : patterns;
    findOptions = findOptions || _getDefaultFindOptions();
    _debugFindOptions(findOptions);
    matchOptions = matchOptions || _getDefaultMatchOptions();
    _debugMatchOptions(matchOptions);

    // normalize slashes for root dir
    defaultRoot = im._normalizeSeparators(defaultRoot);

    let results: { [key: string]: string } = {};
    let originalMatchOptions = matchOptions;
    for (let pattern of (patterns || [])) {
        debug(`pattern: '${pattern}'`);

        // trim and skip empty
        pattern = (pattern || '').trim();
        if (!pattern) {
            debug('skipping empty pattern');
            continue;
        }

        // clone match options
        let matchOptions = im._cloneMatchOptions(originalMatchOptions);

        // skip comments
        if (!matchOptions.nocomment && im._startsWith(pattern, '#')) {
            debug('skipping comment');
            continue;
        }

        // set nocomment - brace expansion could result in a leading '#'
        matchOptions.nocomment = true;

        // determine whether pattern is include or exclude
        let negateCount = 0;
        if (!matchOptions.nonegate) {
            while (pattern.charAt(negateCount) == '!') {
                negateCount++;
            }

            pattern = pattern.substring(negateCount); // trim leading '!'
            if (negateCount) {
                debug(`trimmed leading '!'. pattern: '${pattern}'`);
            }
        }

        let isIncludePattern = negateCount == 0 ||
            (negateCount % 2 == 0 && !matchOptions.flipNegate) ||
            (negateCount % 2 == 1 && matchOptions.flipNegate);

        // set nonegate - brace expansion could result in a leading '!'
        matchOptions.nonegate = true;
        matchOptions.flipNegate = false;

        // expand braces - required to accurately interpret findPath
        let expanded: string[];
        let preExpanded: string = pattern;
        if (matchOptions.nobrace) {
            expanded = [pattern];
        }
        else {
            // convert slashes on Windows before calling braceExpand(). unfortunately this means braces cannot
            // be escaped on Windows, this limitation is consistent with current limitations of minimatch (3.0.3).
            debug('expanding braces');
            let convertedPattern = process.platform == 'win32' ? pattern.replace(/\\/g, '/') : pattern;
            expanded = (minimatch as any).braceExpand(convertedPattern);
        }

        // set nobrace
        matchOptions.nobrace = true;

        for (let pattern of expanded) {
            if (expanded.length != 1 || pattern != preExpanded) {
                debug(`pattern: '${pattern}'`);
            }

            // trim and skip empty
            pattern = (pattern || '').trim();
            if (!pattern) {
                debug('skipping empty pattern');
                continue;
            }

            if (isIncludePattern) {
                // determine the findPath
                let findInfo: im._PatternFindInfo = im._getFindInfoFromPattern(defaultRoot, pattern, matchOptions);
                let findPath: string = findInfo.findPath;
                debug(`findPath: '${findPath}'`);

                if (!findPath) {
                    debug('skipping empty path');
                    continue;
                }

                // perform the find
                debug(`statOnly: '${findInfo.statOnly}'`);
                let findResults: string[] = [];
                if (findInfo.statOnly) {
                    // simply stat the path - all path segments were used to build the path
                    try {
                        fs.statSync(findPath);
                        findResults.push(findPath);
                    }
                    catch (err) {
                        if (err.code != 'ENOENT') {
                            throw err;
                        }

                        debug('ENOENT');
                    }
                }
                else {
                    findResults = find(findPath, findOptions);
                }

                debug(`found ${findResults.length} paths`);

                // apply the pattern
                debug('applying include pattern');
                if (findInfo.adjustedPattern != pattern) {
                    debug(`adjustedPattern: '${findInfo.adjustedPattern}'`);
                    pattern = findInfo.adjustedPattern;
                }

                let matchResults: string[] = minimatch.match(findResults, pattern, matchOptions);
                debug(matchResults.length + ' matches');

                // union the results
                for (let matchResult of matchResults) {
                    let key = process.platform == 'win32' ? matchResult.toUpperCase() : matchResult;
                    results[key] = matchResult;
                }
            }
            else {
                // check if basename only and matchBase=true
                if (matchOptions.matchBase &&
                    !im._isRooted(pattern) &&
                    (process.platform == 'win32' ? pattern.replace(/\\/g, '/') : pattern).indexOf('/') < 0) {

                    // do not root the pattern
                    debug('matchBase and basename only');
                }
                else {
                    // root the exclude pattern
                    pattern = im._ensurePatternRooted(defaultRoot, pattern);
                    debug(`after ensurePatternRooted, pattern: '${pattern}'`);
                }

                // apply the pattern
                debug('applying exclude pattern');
                let matchResults: string[] = minimatch.match(
                    Object.keys(results).map((key: string) => results[key]),
                    pattern,
                    matchOptions);
                debug(matchResults.length + ' matches');

                // substract the results
                for (let matchResult of matchResults) {
                    let key = process.platform == 'win32' ? matchResult.toUpperCase() : matchResult;
                    delete results[key];
                }
            }
        }
    }

    let finalResult: string[] = Object.keys(results)
        .map((key: string) => results[key])
        .sort();
    debug(finalResult.length + ' final results');
    return finalResult;
}

//-----------------------------------------------------
// Http Proxy Helper
//-----------------------------------------------------

export interface ProxyConfiguration {
    proxyUrl: string;
    /**
     * Proxy URI formated as: protocol://username:password@hostname:port
     * 
     * For tools that require setting proxy configuration in the single environment variable
     */
    proxyFormattedUrl: string;
    proxyUsername?: string;
    proxyPassword?: string;
    proxyBypassHosts?: string[];
}

/**
 * Build Proxy URL in the following format: protocol://username:password@hostname:port
 * @param proxyUrl Url address of the proxy server (eg: http://example.com)
 * @param proxyUsername Proxy username (optional)
 * @param proxyPassword Proxy password (optional)
 * @returns string
 */
function getProxyFormattedUrl(proxyUrl: string, proxyUsername: string | undefined, proxyPassword: string | undefined): string {
    const parsedUrl: URL = new URL(proxyUrl);
    let proxyAddress: string = `${parsedUrl.protocol}//${parsedUrl.host}`;
    if (proxyUsername) {
        proxyAddress = `${parsedUrl.protocol}//${proxyUsername}:${proxyPassword}@${parsedUrl.host}`;
    }
    return proxyAddress;
}

/**
 * Gets http proxy configuration used by Build/Release agent
 *
 * @return  ProxyConfiguration
 */
export function getHttpProxyConfiguration(requestUrl?: string): ProxyConfiguration | null {
    let proxyUrl = getVariable('Agent.ProxyUrl');
    if (proxyUrl && proxyUrl.length > 0) {
        let proxyUsername = getVariable('Agent.ProxyUsername');
        let proxyPassword = getVariable('Agent.ProxyPassword');
        let proxyBypassHosts = JSON.parse(getVariable('Agent.ProxyBypassList') || '[]');

        let bypass: boolean = false;
        if (requestUrl) {
            proxyBypassHosts.forEach(bypassHost => {
                if (new RegExp(bypassHost, 'i').test(requestUrl)) {
                    bypass = true;
                }
            });
        }

        if (bypass) {
            return null;
        }
        else {
            const proxyAddress = getProxyFormattedUrl(proxyUrl, proxyUsername, proxyPassword)
            return {
                proxyUrl: proxyUrl,
                proxyUsername: proxyUsername,
                proxyPassword: proxyPassword,
                proxyBypassHosts: proxyBypassHosts,
                proxyFormattedUrl: proxyAddress
            };
        }
    }
    else {
        return null;
    }
}

//-----------------------------------------------------
// Http Certificate Helper
//-----------------------------------------------------

export interface CertConfiguration {
    caFile?: string;
    certFile?: string;
    keyFile?: string;
    certArchiveFile?: string;
    passphrase?: string;
}

/**
 * Gets http certificate configuration used by Build/Release agent
 *
 * @return  CertConfiguration
 */
export function getHttpCertConfiguration(): CertConfiguration | null {
    let ca = getVariable('Agent.CAInfo');
    let clientCert = getVariable('Agent.ClientCert');

    if (ca || clientCert) {
        let certConfig: CertConfiguration = {};
        certConfig.caFile = ca;
        certConfig.certFile = clientCert;

        if (clientCert) {
            let clientCertKey = getVariable('Agent.ClientCertKey');
            let clientCertArchive = getVariable('Agent.ClientCertArchive');
            let clientCertPassword = getVariable('Agent.ClientCertPassword');

            certConfig.keyFile = clientCertKey;
            certConfig.certArchiveFile = clientCertArchive;
            certConfig.passphrase = clientCertPassword;
        }

        return certConfig;
    }
    else {
        return null;
    }
}

//-----------------------------------------------------
// Test Publisher
//-----------------------------------------------------
export class TestPublisher {
    constructor(public testRunner: string) {
    }

    public publish(resultFiles?: string | string[], mergeResults?: string, platform?: string, config?: string, runTitle?: string, publishRunAttachments?: string, testRunSystem?: string) {
        // Could have used an initializer, but wanted to avoid reordering parameters when converting to strict null checks
        // (A parameter cannot both be optional and have an initializer)
        testRunSystem = testRunSystem || "VSTSTask";

        var properties = <{ [key: string]: string }>{};
        properties['type'] = this.testRunner;

        if (mergeResults) {
            properties['mergeResults'] = mergeResults;
        }

        if (platform) {
            properties['platform'] = platform;
        }

        if (config) {
            properties['config'] = config;
        }

        if (runTitle) {
            properties['runTitle'] = runTitle;
        }

        if (publishRunAttachments) {
            properties['publishRunAttachments'] = publishRunAttachments;
        }

        if (resultFiles) {
            properties['resultFiles'] = Array.isArray(resultFiles) ? resultFiles.join() : resultFiles;
        }

        properties['testRunSystem'] = testRunSystem;

        command('results.publish', properties, '');
    }
}

//-----------------------------------------------------
// Code coverage Publisher
//-----------------------------------------------------
export class CodeCoveragePublisher {
    constructor() {
    }
    public publish(codeCoverageTool?: string, summaryFileLocation?: string, reportDirectory?: string, additionalCodeCoverageFiles?: string | string[]) {

        var properties = <{ [key: string]: string }>{};

        if (codeCoverageTool) {
            properties['codecoveragetool'] = codeCoverageTool;
        }

        if (summaryFileLocation) {
            properties['summaryfile'] = summaryFileLocation;
        }

        if (reportDirectory) {
            properties['reportdirectory'] = reportDirectory;
        }

        if (additionalCodeCoverageFiles) {
            properties['additionalcodecoveragefiles'] = Array.isArray(additionalCodeCoverageFiles) ? additionalCodeCoverageFiles.join() : additionalCodeCoverageFiles;
        }

        command('codecoverage.publish', properties, "");
    }
}

//-----------------------------------------------------
// Code coverage Publisher
//-----------------------------------------------------
export class CodeCoverageEnabler {
    private buildTool: string;
    private ccTool: string;

    constructor(buildTool: string, ccTool: string) {
        this.buildTool = buildTool;
        this.ccTool = ccTool;
    }

    public enableCodeCoverage(buildProps: { [key: string]: string }) {
        buildProps['buildtool'] = this.buildTool;
        buildProps['codecoveragetool'] = this.ccTool;
        command('codecoverage.enable', buildProps, "");
    }
}

//-----------------------------------------------------
// Task Logging Commands
//-----------------------------------------------------

/**
 * Upload user interested file as additional log information
 * to the current timeline record.
 *
 * The file shall be available for download along with task logs.
 *
 * @param path      Path to the file that should be uploaded.
 * @returns         void
 */
export function uploadFile(path: string) {
    command("task.uploadfile", null, path);
}

/**
 * Instruction for the agent to update the PATH environment variable.
 * The specified directory is prepended to the PATH.
 * The updated environment variable will be reflected in subsequent tasks.
 *
 * @param path      Local directory path.
 * @returns         void
 */
export function prependPath(path: string) {
    assertAgent("2.115.0");
    command("task.prependpath", null, path);
}

/**
 * Upload and attach summary markdown to current timeline record.
 * This summary shall be added to the build/release summary and
 * not available for download with logs.
 *
 * @param path      Local directory path.
 * @returns         void
 */
export function uploadSummary(path: string) {
    command("task.uploadsummary", null, path);
}

/**
 * Upload and attach attachment to current timeline record.
 * These files are not available for download with logs.
 * These can only be referred to by extensions using the type or name values.
 *
 * @param type      Attachment type.
 * @param name      Attachment name.
 * @param path      Attachment path.
 * @returns         void
 */
export function addAttachment(type: string, name: string, path: string) {
    command("task.addattachment", { "type": type, "name": name }, path);
}

/**
 * Set an endpoint field with given value.
 * Value updated will be retained in the endpoint for
 * the subsequent tasks that execute within the same job.
 *
 * @param id      Endpoint id.
 * @param field   FieldType enum of AuthParameter, DataParameter or Url.
 * @param key     Key.
 * @param value   Value for key or url.
 * @returns       void
 */
export function setEndpoint(id: string, field: FieldType, key: string, value: string) {
    command("task.setendpoint", { "id": id, "field": FieldType[field].toLowerCase(), "key": key }, value);
}

/**
 * Set progress and current operation for current task.
 *
 * @param percent           Percentage of completion.
 * @param currentOperation  Current pperation.
 * @returns                 void
 */
export function setProgress(percent: number, currentOperation: string) {
    command("task.setprogress", { "value": `${percent}` }, currentOperation);
}

/**
 * Indicates whether to write the logging command directly to the host or to the output pipeline.
 *
 * @param id            Timeline record Guid.
 * @param parentId      Parent timeline record Guid.
 * @param recordType    Record type.
 * @param recordName    Record name.
 * @param order         Order of timeline record.
 * @param startTime     Start time.
 * @param finishTime    End time.
 * @param progress      Percentage of completion.
 * @param state         TaskState enum of Unknown, Initialized, InProgress or Completed.
 * @param result        TaskResult enum of Succeeded, SucceededWithIssues, Failed, Cancelled or Skipped.
 * @param message       current operation
 * @returns             void
 */
export function logDetail(id: string, message: string, parentId?: string, recordType?: string,
    recordName?: string, order?: number, startTime?: string, finishTime?: string,
    progress?: number, state?: TaskState, result?: TaskResult) {
    const properties = {
        "id": id,
        "parentid": parentId,
        "type": recordType,
        "name": recordName,
        "order": order ? order.toString() : undefined,
        "starttime": startTime,
        "finishtime": finishTime,
        "progress": progress ? progress.toString() : undefined,
        "state": state ? TaskState[state] : undefined,
        "result": result ? TaskResult[result] : undefined
    };

    command("task.logdetail", properties, message);
}

/**
 * Log error or warning issue to timeline record of current task.
 *
 * @param type          IssueType enum of Error or Warning.
 * @param sourcePath    Source file location.
 * @param lineNumber    Line number.
 * @param columnNumber  Column number.
 * @param code          Error or warning code.
 * @param message       Error or warning message.
 * @returns             void
 */
export function logIssue(type: IssueType, message: string, sourcePath?: string, lineNumber?: number,
    columnNumber?: number, errorCode?: string) {
    const properties = {
        "type": IssueType[type].toLowerCase(),
        "code": errorCode,
        "sourcepath": sourcePath,
        "linenumber": lineNumber ? lineNumber.toString() : undefined,
        "columnnumber": columnNumber ? columnNumber.toString() : undefined,
    };

    command("task.logissue", properties, message);
}

//-----------------------------------------------------
// Artifact Logging Commands
//-----------------------------------------------------

/**
 * Upload user interested file as additional log information
 * to the current timeline record.
 *
 * The file shall be available for download along with task logs.
 *
 * @param containerFolder   Folder that the file will upload to, folder will be created if needed.
 * @param path              Path to the file that should be uploaded.
 * @param name              Artifact name.
 * @returns                 void
 */
export function uploadArtifact(containerFolder: string, path: string, name?: string) {
    command("artifact.upload", { "containerfolder": containerFolder, "artifactname": name }, path);
}

/**
 * Create an artifact link, artifact location is required to be
 * a file container path, VC path or UNC share path.
 *
 * The file shall be available for download along with task logs.
 *
 * @param name              Artifact name.
 * @param path              Path to the file that should be associated.
 * @param artifactType      ArtifactType enum of Container, FilePath, VersionControl, GitRef or TfvcLabel.
 * @returns                 void
 */
export function associateArtifact(name: string, path: string, artifactType: ArtifactType) {
    command("artifact.associate", { "type": ArtifactType[artifactType].toLowerCase(), "artifactname": name }, path);
}

//-----------------------------------------------------
// Build Logging Commands
//-----------------------------------------------------

/**
 * Upload user interested log to build’s container “logs\tool” folder.
 *
 * @param path      Path to the file that should be uploaded.
 * @returns         void
 */
export function uploadBuildLog(path: string) {
    command("build.uploadlog", null, path);
}

/**
 * Update build number for current build.
 *
 * @param value     Value to be assigned as the build number.
 * @returns         void
 */
export function updateBuildNumber(value: string) {
    command("build.updatebuildnumber", null, value);
}

/**
 * Add a tag for current build.
 *
 * @param value     Tag value.
 * @returns         void
 */
export function addBuildTag(value: string) {
    command("build.addbuildtag", null, value);
}

//-----------------------------------------------------
// Release Logging Commands
//-----------------------------------------------------

/**
 * Update release name for current release.
 *
 * @param value     Value to be assigned as the release name.
 * @returns         void
 */
export function updateReleaseName(name: string) {
    assertAgent("2.132.0");
    command("release.updatereleasename", null, name);
}

//-----------------------------------------------------
// Tools
//-----------------------------------------------------
exports.TaskCommand = tcm.TaskCommand;
exports.commandFromString = tcm.commandFromString;
exports.ToolRunner = trm.ToolRunner;

//-----------------------------------------------------
// Validation Checks
//-----------------------------------------------------

// async await needs generators in node 4.x+
if (semver.lt(process.versions.node, '4.2.0')) {
    warning('Tasks require a new agent.  Upgrade your agent or node to 4.2.0 or later', IssueSource.TaskInternal);
}

//-------------------------------------------------------------------
// Populate the vault with sensitive data.  Inputs and Endpoints
//-------------------------------------------------------------------

// avoid loading twice (overwrites .taskkey)
if (!global['_vsts_task_lib_loaded']) {
    im._loadData();
    im._exposeProxySettings();
    im._exposeCertSettings();
}
