// Replaces vsts-task-lib for testing purposes.
import fs = require('fs');
import util = require('util');
import shell = require('shelljs');

export var debugLog:string = '';
export var warningLog:string = '';
export var errorLog:string = '';

export var resourceFilePath;

var CMD_PREFIX = '##vso[';

export enum TaskResult {
    Succeeded = 0,
    Failed = 1
}

export interface EndpointAuthorization {
    parameters: {
        [key: string]: string;
    };
    scheme: string;
}

export class TaskCommand {
    constructor(command, properties, message) {
        if (!command) {
            command = 'missing.command';
        }

        this.command = command;
        this.properties = properties;
        this.message = message;
    }

    public command:string;
    public message:string;
    public properties:{ [key: string]: string };

    public toString() {
        var cmdStr = CMD_PREFIX + this.command;

        if (this.properties && Object.keys(this.properties).length > 0) {
            cmdStr += ' ';
            for (var key in this.properties) {
                if (this.properties.hasOwnProperty(key)) {
                    var val = this.properties[key];
                    if (val) {
                        cmdStr += key + '=' + val + ';';
                    }
                }
            }
        }

        cmdStr += ']' + this.message;
        return cmdStr;
    }
}

/* Main implementation */
// Implements tl.setResult()
export function setResult(result:TaskResult, message:string):void {
    debug('task result: ' + TaskResult[result]);
    command('task.complete', {'result': TaskResult[result]}, message);

    if (result == TaskResult.Failed) {
        error(message);
    }

    if (result == TaskResult.Failed) {
        process.exit(0);
    }
}

// Replaces tl.debug()
export function debug(input:string) {
    console.log(input);
    debugLog += input + '\r\n';
}

// Replaces tl.warning()
export function warning(input:string) {
    console.log(input);
    warningLog += input + '\r\n';
}

// Replaces tl.error()
export function error(input:string) {
    console.log(input);
    errorLog += input + '\r\n';
}

// A working implementation of tl.rmRF().
// Warning: fully functional, unlike the test implementation of tl.rmRF()
export function rmRF(path:string, continueOnError?:boolean):void {
    debug('rm -rf ' + path);
    shell.rm('-rf', path);

    var errMsg:string = shell.error();

    // if you try to delete a file that doesn't exist, desired result is achieved
    // other errors are valid
    if (errMsg && !(errMsg.indexOf('ENOENT') === 0)) {
        throw new Error('rm -rf failed with error ' + errMsg);
    }
}

// A working implementation of tl.checkPath().
// Warning: fully functional. If the file does not exist, the task will fail.
export function checkPath(p:string, name:string):void {
    debug('check path : ' + p);
    if (!p) {

        setResult(TaskResult.Failed, 'not found ' + name + ': ' + p);  // exit
    }
}

// A working implementation of tl.mkdirP().
// Warning: fully functional, unlike the test implementation of tl.mkdirP()
export function mkdirP(p):void {
    if (!p) {
        throw new Error('Expected a parameter.');
    }

    // certain chars like \0 will cause shelljs and fs
    // to blow up without exception or error
    if (p.indexOf('\0') >= 0) {
        throw new Error(loc('LIB_PathHasNullByte'));
    }

    if (!shell.test('-d', p)) {
        debug('creating path: ' + p);
        shell.mkdir('-p', p);
        checkShell('mkdirP');
    }
    else {
        debug('path exists: ' + p);
    }
}

// A working implementation of tl.cp().
// Warning: fully functional, unlike the test implementation of tl.cp()
export function cp(source:string, dest:string, options?:string, continueOnError?:boolean):void {
    if (options) {
        shell.cp(options, source, dest);
    }
    else {
        shell.cp(source, dest);
    }

    checkShell('cp', continueOnError);
}

// A working implementation of tl.exist().
// Warning: fully functional, unlike the test implementation of tl.exist()
export function exist(path:string):boolean {
    var exist = false;
    try {
        exist = path && fs.statSync(path) != null;
    } catch (err) {
        if (err && err.code === 'ENOENT') {
            exist = false;
        } else {
            throw err;
        }
    }
    return exist;
}

// Working implementation of setResourcePath(path).
// Warning: multiple calls to this file will result in odd behaviour.
export function setResourcePath(path:string):void {
    if (!resourceFilePath) {
        resourceFilePath = path;
        debug('set resource file to: ' + resourceFilePath);

        var locStrs = loadLocStrings(resourceFilePath);
        for (var key in locStrs) {
            debug('cache loc string: ' + key);
            setLoc(key, locStrs[key]);
        }

    }
    else {
        warning('resource file is already set to: ' + resourceFilePath);
    }
}

// Replaces tl.loc(). Use setResourcePath(path) or setLoc(key, value) in setup.
export function loc(key:string):string {
    return process.env[getLocEnvVar(key)] || key;
}

// Replaces tl.getInput(key). Use setInput(key, value) in setup.
export function getInput(key:string, required?:boolean):string {
    var value = process.env[getInputEnvVar(key)];
    if (required && !value) {
        throw new Error(`Required input key ${key} has not been set.`);
    }

    return value;
}

export function getBoolInput(name:string, required?:boolean):boolean {
    var input:string = getInput(name, required);
    return (input && input.toUpperCase() == "TRUE");
}

//
// Split - do not use for splitting args!  Instead use arg() - it will split and handle
//         this is for splitting a simple list of items like targets
//
export function getDelimitedInput(name:string, delim:string, required?:boolean):string[] {
    var inval = getInput(name, required);
    if (!inval) {
        return [];
    }
    return inval.split(delim);
}

export function getPathInput(name:string, required?:boolean, check?:boolean):string {
    var inval = getInput(name, required);
    if (inval) {
        if (check) {
            checkPath(inval, name);
        }

        if (inval.indexOf(' ') > 0) {
            if (!startsWith(inval, '"')) {
                inval = '"' + inval;
            }

            if (!endsWith(inval, '"')) {
                inval += '"';
            }
        }
    } else if (required) {
        setResult(TaskResult.Failed, 'Input required: ' + name); // exit
    }

    debug(name + '=' + inval);
    return inval;
}

// Replaces tl.getVariable(key). Use setVariable(key, value) in setup.
export function getVariable(key:string):string {
    return process.env[getVariableEnvVar(key)];
}

export function getEndpointUrl(id: string, optional: boolean): string {
    var urlval = getVariable('ENDPOINT_URL_' + id);
    debug(id + '=' + urlval);

    if (!optional && !urlval) {
        error('Endpoint not present: ' + id);
        throw new Error('Endpoint not present: ' + id);
    }

    return urlval;
}

export function getEndpointAuthorization(id: string, optional: boolean): EndpointAuthorization {
    var aval = getVariable('ENDPOINT_AUTH_' + id);
    debug(id + '=' + aval);

    if (!optional && !aval) {
        setResult(TaskResult.Failed, 'Endpoint not present: ' + id);
    }

    var auth: EndpointAuthorization;
    try {
        auth = <EndpointAuthorization>JSON.parse(aval);
    }
    catch (err) {
        setResult(TaskResult.Failed, 'Invalid endpoint auth: ' + aval); // exit
    }

    return auth;
}

// Replaces tl.command(). As the original is a black box with no observable local effect, this does nothing except debug log.
export function command(command:string, properties, message:string) {
    var taskCmd = new TaskCommand(command, properties, message);
    debug(taskCmd.toString());
}

/* Setup implementation */

export function commandFromString(commandLine:string):TaskCommand {
    var preLen = CMD_PREFIX.length;
    var lbPos = commandLine.indexOf('##vso[') + preLen - 1;
    var rbPos = commandLine.indexOf(']', lbPos);
    if (lbPos == -1 || rbPos == -1 || rbPos - lbPos < 3) {
        throw new Error('Invalid command brackets');
    }
    var cmdInfo = commandLine.substring(lbPos + 1, rbPos);
    var spaceIdx = cmdInfo.indexOf(' ');

    var command = cmdInfo;
    var properties = {};

    if (spaceIdx > 0) {
        command = cmdInfo.trim().substring(0, spaceIdx);
        var propSection = cmdInfo.trim().substring(spaceIdx + 1);

        var propLines = propSection.split(';');
        propLines.forEach(function (propLine) {
            propLine = propLine.trim();
            if (propLine.length > 0) {
                var propParts = propLine.split('=');
                if (propParts.length != 2) {
                    throw new Error('Invalid property: ' + propLine);
                }
                properties[propParts[0]] = propParts[1];
            }
        });
    }

    var msg:string = commandLine.substring(rbPos + 1);
    var cmd:TaskCommand = new TaskCommand(command, properties, msg);
    return cmd;
}


export function setLoc(key:string, value:string):void {
    process.env[getLocEnvVar(key)] = value;
}

export function setInput(key:string, value:string):void {
    process.env[getInputEnvVar(key)] = value;
}

export function setVariable(key:string, value:string):void {
    process.env[getVariableEnvVar(key)] = value;
}

/* Internal implementation */

function isTestLoggingEnabled():boolean {
    var envVarSetting:string = process.env['TASK_TEST_TRACE'];
    if (envVarSetting && (envVarSetting.toUpperCase() == 'TRUE' || envVarSetting == '1')) {
        return true;
    }
    return false;
}

function checkShell(cmd:string, continueOnError?:boolean) {
    var se = shell.error();

    if (se) {
        debug(cmd + ' failed');
        var errMsg = loc(`Shell operation "${cmd}" failed with error ${se}`);
        debug(errMsg);

        if (!continueOnError) {
            throw new Error(errMsg);
        }
    }
}

// Transforms a loc key into an env var key.
function getLocEnvVar(key:string):string {
    return 'LOC_' + key;
}

// Transforms an input key into an env var key.
function getInputEnvVar(key:string):string {
    return 'INP_' + key;
}

// Transforms a variable key into an env var key.
function getVariableEnvVar(key:string):string {
    return 'VAR_' + key;
}

function loadLocStrings(resourceFile:string):any {
    var locStrings:{
        [key: string]: string
    } = {};

    if (resourceFile && fs.existsSync(resourceFile)) {
        debug('load loc strings from: ' + resourceFile);
        var resourceJson = require(resourceFile);

        if (resourceJson && resourceJson.hasOwnProperty('messages')) {
            for (var key in resourceJson.messages) {
                if (typeof (resourceJson.messages[key]) === 'object') {
                    if (resourceJson.messages[key].loc && resourceJson.messages[key].loc.toString().length > 0) {
                        locStrings[key] = resourceJson.messages[key].loc.toString();
                    }
                    else if (resourceJson.messages[key].fallback) {
                        locStrings[key] = resourceJson.messages[key].fallback.toString();
                    }
                }
                else if (typeof (resourceJson.messages[key]) === 'string') {
                    locStrings[key] = resourceJson.messages[key];
                }
            }
        }
    }

    return locStrings;
}

//-----------------------------------------------------
// String convenience
//-----------------------------------------------------

function startsWith(str:string, start:string):boolean {
    return str.slice(0, start.length) == start;
}

function endsWith(str:string, start:string):boolean {
    return str.slice(-str.length) == str;
}