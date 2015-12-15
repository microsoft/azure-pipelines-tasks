/// <reference path="../../../../definitions/node.d.ts" />

var Q = require('q');
var path = require('path');
var os = require('os');

import fs = require('fs');
import tcm = require('./taskcommand');
import trm = require('./toolrunner');
import mock = require('./mock');

export enum TaskResult {
    Succeeded = 0,
    Failed = 1
}

//-----------------------------------------------------
// String convenience
//-----------------------------------------------------

function startsWith(str: string, start: string): boolean {
    return str.slice(0, start.length) == start;
}

function endsWith(str: string, start: string): boolean {
    return str.slice(-str.length) == str;
}

//-----------------------------------------------------
// General Helpers
//-----------------------------------------------------
export var _outStream = process.stdout;
export var _errStream = process.stderr;

export function _writeError(str: string): void {
    _errStream.write(str + os.EOL);
}

export function _writeLine(str: string): void {
    _outStream.write(str + os.EOL);
}

export function setStdStream(stdStream): void {
    _outStream = stdStream;
}

export function setErrStream(errStream): void {
    _errStream = errStream;
}


//-----------------------------------------------------
// Results and Exiting
//-----------------------------------------------------

export function setResult(result: TaskResult, message: string, exit?: boolean): void {
    debug('task result: ' + TaskResult[result]);
    command('task.complete', {'result': TaskResult[result]}, message);

    if (result == TaskResult.Failed) {
        _writeError(message);
    }

    console.log('exit: ' + exit);
    if (exit) {
        process.exit(0);
    }    
}

//
// Catching all exceptions
//
process.on('uncaughtException', (err) => {
    setResult(TaskResult.Failed, 'Unhandled:' + err.message, true);
});

export function exitOnCodeIf(code, condition: boolean) {
    if (condition) {
        setResult(TaskResult.Failed, 'failure return code: ' + code, true);
    }
}

//
// back compat: should use setResult
//
export function exit(code: number): void {
    setResult(code, 'return code: ' + code, true);
}

//-----------------------------------------------------
// Input Helpers
//-----------------------------------------------------
export function getVariable(name: string): string {
    var varval = process.env[name.replace(/\./g, '_').toUpperCase()];
    debug(name + '=' + varval);

    var mocked =  mock.getResponse('getVariable', name);
    return mocked || varval;
}

export function setVariable(name: string, val: string): void {
    if (!name) {
        _writeError('name required: ' + name);
        exit(1);
    }

    var varValue = val || '';
    process.env[name.replace(/\./g, '_').toUpperCase()] = varValue;
    debug('set ' + name + '=' + varValue);
    command('task.setvariable', {'variable': name || ''}, varValue);
}

export function getInput(name: string, required?: boolean): string {
    var inval = process.env['INPUT_' + name.replace(' ', '_').toUpperCase()];

    if (required && !inval) {
        setResult(TaskResult.Failed, 'Input required: ' + name, true);
    }

    debug(name + '=' + inval);
    return inval;    
}

export function getBoolInput(name: string, required?:boolean): boolean {
    return getInput(name, required) == "true";
}

export function setEnvVar(name: string, val: string): void {
    if (val) {
        process.env[name] = val;
    }
}

//
// Split - do not use for splitting args!  Instead use arg() - it will split and handle
//         this is for splitting a simple list of items like targets
//
export function getDelimitedInput(name: string, delim: string, required?: boolean): string[] {
    var inval = getInput(name, required);
    if (!inval) {
        return [];
    }    
    return inval.split(delim);
}

export function filePathSupplied(name: string): boolean {
    // normalize paths
    var pathValue = path.resolve(this.getPathInput(name) || '');
    var repoRoot = path.resolve(this.getVariable('build.sourcesDirectory') || '');

    var supplied = pathValue !== repoRoot;
    debug(name + 'path supplied :' + supplied);
    return supplied;
}

export function getPathInput(name: string, required?: boolean, check?: boolean): string {
    var inval = process.env['INPUT_' + name.replace(' ', '_').toUpperCase()];
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
        setResult(TaskResult.Failed, 'Input required: ' + name, true); // exit
    }

    debug(name + '=' + inval);
    return inval;
}

//-----------------------------------------------------
// Endpoint Helpers
//-----------------------------------------------------

export function getEndpointUrl(id: string, optional: boolean): string {
    var urlval = process.env['ENDPOINT_URL_' + id];

    if (!optional && !urlval) {
        _writeError('Endpoint not present: ' + id);
        exit(1);
    }

    debug(id + '=' + urlval);
    return urlval;    
}

// TODO: should go away when task lib 
export interface EndpointAuthorization {
    parameters: {
        [key: string]: string;
    };
    scheme: string;
}

export function getEndpointAuthorization(id: string, optional: boolean): EndpointAuthorization {
    var aval = process.env['ENDPOINT_AUTH_' + id];

    if (!optional && !aval) {
        setResult(TaskResult.Failed, 'Endpoint not present: ' + id, true);
    }

    debug(id + '=' + aval);

    var auth: EndpointAuthorization;
    try {
        auth = <EndpointAuthorization>JSON.parse(aval);
    }
    catch (err) {
        setResult(TaskResult.Failed, 'Invalid endpoint auth: ' + aval, true); // exit
    }

    return auth;
}

//-----------------------------------------------------
// Fs Helpers
//-----------------------------------------------------
export class FsStats implements fs.Stats {
    private m_isFile;
    private m_isDirectory;
    private m_isBlockDevice;
    private m_isCharacterDevice;
    private m_isSymbolicLink;
    private m_isFIFO;
    private m_isSocket;
    
    dev: number;
    ino: number;
    mode: number;
    nlink: number;
    uid: number;
    gid: number;
    rdev: number;
    size: number;
    blksize: number;
    blocks: number;
    atime: Date;
    mtime: Date;
    ctime: Date;
        
    setAnswers(mockResponses) {
        this.m_isFile = mockResponses['isFile'];
        this.m_isDirectory = mockResponses['isDirectory'];
        this.m_isBlockDevice = mockResponses['isBlockDevice'];
        this.m_isCharacterDevice = mockResponses['isCharacterDevice'];
        this.m_isSymbolicLink = mockResponses['isSymbolicLink'];
        this.m_isFIFO = mockResponses['isFIFO'];
        this.m_isSocket = mockResponses['isSocket'];  
        
        this.dev = mockResponses['dev'];
        this.ino = mockResponses['ino'];
        this.mode = mockResponses['mode'];
        this.nlink = mockResponses['nlink'];
        this.uid = mockResponses['uid'];
        this.gid = mockResponses['gid'];
        this.rdev = mockResponses['rdev'];   
        this.size = mockResponses['size'];
        this.blksize = mockResponses['blksize'];
        this.blocks = mockResponses['blocks'];
        this.atime = mockResponses['atime'];
        this.mtime = mockResponses['mtime'];
        this.ctime = mockResponses['ctime'];
        this.m_isSocket = mockResponses['isSocket'];         
    }
    
    isFile(): boolean {
        return this.m_isFile;
    }
    
    isDirectory(): boolean {
        return this.m_isDirectory;
    }
    
    isBlockDevice(): boolean {
        return this.m_isBlockDevice;
    }
    
    isCharacterDevice(): boolean {
        return this.m_isCharacterDevice;
    }
    
    isSymbolicLink(): boolean {
        return this.m_isSymbolicLink;
    }
    
    isFIFO(): boolean {
        return this.m_isFIFO;
    }
    
    isSocket(): boolean {
        return this.m_isSocket;
    }
}

export function stats(path: string): FsStats {
    var fsStats = new FsStats();
    fsStats.setAnswers(mock.getResponse('stats', path));
    return fsStats;
}

//-----------------------------------------------------
// Cmd Helpers
//-----------------------------------------------------
export function command(command: string, properties, message: string) {
    var taskCmd = new tcm.TaskCommand(command, properties, message);
    _writeLine(taskCmd.toString());
}

export function warning(message: string): void {
    command('task.issue', {'type': 'warning'}, message);
}

export function error(message: string): void {
    command('task.issue', {'type': 'error'}, message);
}

export function debug(message: string): void {
    command('task.debug', null, message);
}

var _argStringToArray = function(argString: string): string[] {
    var args = argString.match(/([^" ]*("[^"]*")[^" ]*)|[^" ]+/g);

    for (var i = 0; i < args.length; i++) {
        args[i] = args[i].replace(/"/g, "");
    }
    return args;
}

export function cd(path: string): void {

}

export function pushd(path: string): void {

}

export function popd(): void {

}

//------------------------------------------------
// Validation Helpers
//------------------------------------------------
export function checkPath(p: string, name: string): void {
    debug('check path : ' + p);
    if (!p || !mock.getResponse('checkPath', p)) {

        setResult(TaskResult.Failed, 'not found ' + name + ': ' + p, true);  // exit
    }
}

//-----------------------------------------------------
// Shell/File I/O Helpers
// Abstract these away so we can
// - default to good error handling
// - inject system.debug info
// - have option to switch internal impl (shelljs now)
//-----------------------------------------------------
export function mkdirP(p): void {
    debug('creating path: ' + p);
}

export function which(tool: string, check?: boolean): string {
    return mock.getResponse('which', tool);
}

export function cp(options, source: string, dest: string): void {
    
}

export function find(findPath: string): string[] {
    return mock.getResponse('find', findPath);
}

export function rmRF(path: string): void {
    var response = mock.getResponse('rmRF', path);
    if (!response['success']) {
        setResult(1, response['message'], true);
    }
}

export function mv(source: string, dest: string, force: boolean, continueOnError?: boolean): boolean {
    debug('moving ' + source + ' to ' + dest);
    return true;
}

export function glob(pattern: string): string[] {
    debug('glob ' + pattern);

    var matches: string[] = mock.getResponse('glob', pattern);
    debug('found ' + matches.length + ' matches');

    if (matches.length > 0) {
        var m = Math.min(matches.length, 10);
        debug('matches:');
        if (m == 10) {
            debug('listing first 10 matches as samples');    
        }
        
        for (var i = 0; i < m; i++) {
            debug(matches[i]);
        }
    }

    return matches;
}

export function globFirst(pattern: string): string {
    debug('globFirst ' + pattern);
    var matches = glob(pattern);

    if (matches.length > 1) {
        warning('multiple workspace matches.  using first.');
    }

    debug('found ' + matches.length + ' matches');

    return matches[0];
}

//-----------------------------------------------------
// Exec convenience wrapper
//-----------------------------------------------------
export function exec(tool: string, args:any, options?:trm.IExecOptions): Q.Promise<number> {
    var toolPath = which(tool, true);
    var tr: trm.ToolRunner = createToolRunner(toolPath);
    if (args) {
        tr.arg(args);
    }
    return tr.exec(options);    
}

export function execSync(tool: string, args:any, options?:trm.IExecOptions): trm.IExecResult {
    var toolPath = which(tool, true);
    var tr: trm.ToolRunner = createToolRunner(toolPath);
    if (args) {
        tr.arg(args);
    }
        
    return tr.execSync(options);    
}

export function createToolRunner(tool: string) {
    var tr: trm.ToolRunner = new trm.ToolRunner(tool);
    tr.on('debug', (message: string) => {
        debug(message);
    })

    return tr;
}

//-----------------------------------------------------
// Matching helpers
//-----------------------------------------------------
export function match(list, pattern, options): string[] {
    return mock.getResponse('match', pattern);
}

export function matchFile(list, pattern, options): string[] {
    return mock.getResponse('match', pattern);
}

export function filter(pattern, options): string[] {
    return mock.getResponse('filter', pattern);
}    

//-----------------------------------------------------
// Test Publisher
//-----------------------------------------------------
export class TestPublisher {
    constructor(testRunner) {
        this.testRunner = testRunner;        
    }

    public testRunner: string;

    public publish(resultFiles, mergeResults, platform, config) {
        
        if(mergeResults == 'true') {
            _writeLine("Merging test results from multiple files to one test run is not supported on this version of build agent for OSX/Linux, each test result file will be published as a separate test run in VSO/TFS.");
        }
        
        var properties = <{[key: string]: string}>{};
        properties['type'] = this.testRunner;
        
        if(platform) {
            properties['platform'] = platform;
        }

        if(config) {
            properties['config'] = config;
        }

        for(var i = 0; i < resultFiles.length; i ++) {            
            command('results.publish',  properties, resultFiles[i]);
        }
    }
}

//-----------------------------------------------------
// Tools
//-----------------------------------------------------
exports.TaskCommand = tcm.TaskCommand;
exports.commandFromString = tcm.commandFromString;
exports.ToolRunner = trm.ToolRunner;
trm.debug = debug;


