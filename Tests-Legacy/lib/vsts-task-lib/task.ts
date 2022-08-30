import Q = require('q');
import path = require('path');
import fs = require('fs');
import os = require('os');
import util = require('util');
import tcm = require('./taskcommand');
import trm = require('./toolrunner');
import mock = require('./mock');

export enum TaskResult {
    Succeeded = 0,
    Failed = 1
}

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

export interface FindOptions {
    followSpecifiedSymbolicLink: boolean;
    followSymbolicLinks: boolean;
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

export function setResult(result: TaskResult, message: string): void {
    debug('task result: ' + TaskResult[result]);
    command('task.complete', { 'result': TaskResult[result] }, message);

    if (result == TaskResult.Failed) {
        _writeError(message);
    }

    if (result == TaskResult.Failed) {
        process.exit(0);
    }
}

//
// Catching all exceptions
//
process.on('uncaughtException', (err) => {
    setResult(TaskResult.Failed, 'Unhandled:' + err.message);
});

export function exitOnCodeIf(code, condition: boolean) {
    if (condition) {
        setResult(TaskResult.Failed, 'failure return code: ' + code);
    }
}

//
// back compat: should use setResult
//
export function exit(code: number): void {
    setResult(code, 'return code: ' + code);
}

//-----------------------------------------------------
// Loc Helpers
//-----------------------------------------------------
var locStringCache: {
    [key: string]: string
} = {};
var resourceFile: string;
var libResourceFileLoaded: boolean = false;

function loadLocStrings(resourceFile: string): any {
    var locStrings: {
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

export function setResourcePath(path: string): void {
    if (process.env['TASKLIB_INPROC_UNITS']) {
        resourceFile = null;
        libResourceFileLoaded = false;
        locStringCache = {};
    }
    if (!resourceFile) {
        resourceFile = path;
        debug('set resource file to: ' + resourceFile);

        var locStrs = loadLocStrings(resourceFile);
        for (var key in locStrs) {
            debug('cache loc string: ' + key);
            locStringCache[key] = locStrs[key];
        }

    }
    else {
        warning('resource file is already set to: ' + resourceFile);
    }
}

export function loc(key: string): string {
    // we can't do ...param if we target ES6 and node 5.  This is what <=ES5 compiles down to.
    var param = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        param[_i - 1] = arguments[_i];
    }

    if (!libResourceFileLoaded) {
        // merge loc strings from vsts-task-lib.
        var libResourceFile = path.join(__dirname, 'lib.json');
        var libLocStrs = loadLocStrings(libResourceFile);
        for (var libKey in libLocStrs) {
            debug('cache vsts-task-lib loc string: ' + libKey);
            locStringCache[libKey] = libLocStrs[libKey];
        }

        libResourceFileLoaded = true;
    }

    var locString;;
    if (locStringCache.hasOwnProperty(key)) {
        locString = locStringCache[key];
    }
    else {
        if (!resourceFile) {
            warning('resource file haven\'t been set, can\'t find loc string for key: ' + key);
        }
        else {
            warning('can\'t find loc string for key: ' + key);
        }

        locString = key;
    }

    if (param.length > 0) {
        return util.format.apply(this, [locString].concat(param));
    }
    else {
        return locString;
    }

}

//-----------------------------------------------------
// Input Helpers
//-----------------------------------------------------
export function getVariable(name: string): string {
    var varval = process.env[name.replace(/\./g, '_').toUpperCase()];
    debug(name + '=' + varval);

    var mocked = mock.getResponse('getVariable', name);
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
    command('task.setvariable', { 'variable': name || '' }, varValue);
}

export function getInput(name: string, required?: boolean): string {
    var inval = process.env['INPUT_' + name.replace(' ', '_').toUpperCase()];

    if (required && !inval) {
        setResult(TaskResult.Failed, 'Input required: ' + name);
    }

    debug(name + '=' + inval);
    return inval;
}

export function getBoolInput(name: string, required?: boolean): boolean {
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
    var pathValue = this.resolve(this.getPathInput(name) || '');
    var repoRoot = this.resolve(this.getVariable('build.sourcesDirectory') || '');

    var supplied = pathValue !== repoRoot;
    debug(name + 'path supplied :' + supplied);
    return supplied;
}

export function getPathInput(name: string, required?: boolean, check?: boolean): string {
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

//-----------------------------------------------------
// Endpoint Helpers
//-----------------------------------------------------

export function getEndpointUrl(id: string, optional: boolean): string {
    var urlval = getVariable('ENDPOINT_URL_' + id);
    debug(id + '=' + urlval);

    if (!optional && !urlval) {
        _writeError('Endpoint not present: ' + id);
        exit(1);
    }

    return urlval;
}

export function getEndpointDataParameter(id: string, key: string, optional: boolean): string {
    var dataParam = getVariable('ENDPOINT_DATA_' + id + '_' + key.toUpperCase());
    debug(id + '=' + dataParam);

    if (!optional && !dataParam) {
        _writeError('Endpoint data not present: ' + id);
        exit(1);
    }

    return dataParam;
}

export function getEndpointAuthorizationScheme(id: string, optional: boolean): string {
    var authScheme = getVariable('ENDPOINT_AUTH_SCHEME_' + id);
    debug(id + '=' + authScheme);

    if (!optional && !authScheme) {
        _writeError('Endpoint auth not present: ' + id);
        exit(1);
    }

    return authScheme;
}

export function getEndpointAuthorizationParameter(id: string, key: string, optional: boolean): string {
    var authParam = getVariable('ENDPOINT_AUTH_PARAMETER_' + id + '_' + key.toUpperCase());
    debug(id + '=' + authParam);

    if (!optional && !authParam) {
        _writeError('Endpoint auth not present: ' + id);
        exit(1);
    }

    return authParam;
}

// TODO: should go away when task lib 
export interface EndpointAuthorization {
    parameters: {
        [key: string]: string;
    };
    scheme: string;
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

//-----------------------------------------------------
// Fs Helpers
//-----------------------------------------------------
export class FsStats implements fs.Stats {
    atimeMs: number;
    mtimeMs: number;
    ctimeMs: number;
    birthtimeMs: number;
    birthtime: Date;
    private m_isFile: boolean;
    private m_isDirectory: boolean;
    private m_isBlockDevice: boolean;
    private m_isCharacterDevice: boolean;
    private m_isSymbolicLink: boolean;
    private m_isFIFO: boolean;
    private m_isSocket: boolean;

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
        this.m_isFile = mockResponses['isFile'] || false;
        this.m_isDirectory = mockResponses['isDirectory'] || false;
        this.m_isBlockDevice = mockResponses['isBlockDevice'] || false;
        this.m_isCharacterDevice = mockResponses['isCharacterDevice'] || false;
        this.m_isSymbolicLink = mockResponses['isSymbolicLink'] || false;
        this.m_isFIFO = mockResponses['isFIFO'] || false;
        this.m_isSocket = mockResponses['isSocket'] || false;

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
    fsStats.setAnswers(mock.getResponse('stats', path) || {});
    return fsStats;
}

export function exist(path: string): boolean {
    return mock.getResponse('exist', path) || false;
}

export interface FsOptions {
    encoding?: string;
    mode?: number;
    flag?: string;
}

export function writeFile(file: string, data: string | Buffer, options?: string | FsOptions) {
    //do nothing
}

export function osType(): string {
    return mock.getResponse('osType', 'osType');
}

export function cwd(): string {
    return mock.getResponse('cwd', 'cwd');
}

//-----------------------------------------------------
// Cmd Helpers
//-----------------------------------------------------
export function command(command: string, properties, message: string) {
    var taskCmd = new tcm.TaskCommand(command, properties, message);
    _writeLine(taskCmd.toString());
}

export function warning(message: string): void {
    command('task.issue', { 'type': 'warning' }, message);
}

export function error(message: string): void {
    command('task.issue', { 'type': 'error' }, message);
}

export function debug(message: string): void {
    command('task.debug', null, message);
}

var _argStringToArray = function (argString: string): string[] {
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

        setResult(TaskResult.Failed, 'not found ' + name + ': ' + p);  // exit
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

export function resolve(): string {
    // we can't do ...param if we target ES6 and node 5.  This is what <=ES5 compiles down to.
    //return the posix implementation in the mock, so paths will be consistent when L0 tests are run on Windows or Mac/Linux
    var absolutePath = path.posix.resolve.apply(this, arguments);
    debug('Absolute path for pathSegments: ' + arguments + ' = ' + absolutePath);
    return absolutePath;
}

export function which(tool: string, check?: boolean): string {
    var response = mock.getResponse('which', tool);
    if (check) {
        checkPath(response, tool);
    }
    return response;
}

export function ls(options: string, paths: string[]): string[] {
    var response = mock.getResponse('ls', paths[0]);
    if (!response) {
        return [];
    }
    return response;
}

export function cp(options, source: string, dest: string): void {
    console.log('###copying###');
    debug('copying ' + source + ' to ' + dest);
}

export function find(findPath: string): string[] {
    return mock.getResponse('find', findPath);
}

export function rmRF(path: string): void {
    debug(`rmRF(${path})`);
    var response = mock.getResponse('rmRF', path);
    if (!response['success']) {
        setResult(1, response['message']);
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
export function exec(tool: string, args: any, options?: trm.IExecOptions): Q.Promise<number> {
    var toolPath = which(tool, true);
    var tr: trm.ToolRunner = createToolRunner(toolPath);
    if (args) {
        tr.arg(args);
    }
    return tr.exec(options);
}

export function execSync(tool: string, args: any, options?: trm.IExecOptions): trm.IExecResult {
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

export function tool(tool: string) {
    return createToolRunner(tool);
}

//-----------------------------------------------------
// Matching helpers
//-----------------------------------------------------
export function match(list: string[], patterns: string[], options): string[];
export function match(list: string[], pattern: string, options): string[];
export function match(list: string[], pattern: any, options): string[] {
    let patterns: string[];
    if (typeof pattern == 'object') {
        patterns = pattern;
    }
    else {
        patterns = [pattern];
    }

    let key: string = patterns.join(',');
    return mock.getResponse('match', key) || [];
}

export function findMatch(defaultRoot: string, patterns: string, findOptions?: FindOptions, matchOptions?: MatchOptions): string[];
export function findMatch(defaultRoot: string, patterns: string[], findOptions?: FindOptions, matchOptions?: MatchOptions): string[]
export function findMatch(defaultRoot: string, patterns: any, findOptions?: FindOptions, matchOptions?: MatchOptions): string[] {
    patterns = patterns || [];
    patterns = typeof patterns == 'string' ? [patterns] as string[] : patterns;
    let key: string = patterns.join(',');
    return mock.getResponse('findMatch', key) || [];
}

export function matchFile(list, pattern, options): string[] {
    return mock.getResponse('match', pattern) || [];
}

export function filter(pattern, options): any {
    var filterList = mock.getResponse('filter', pattern) || [];
    return function (pattern, i, arr) {
        return filterList.indexOf(pattern) >= 0;
    }
}

//-----------------------------------------------------
// Test Publisher
//-----------------------------------------------------
export class TestPublisher {
    constructor(testRunner) {
        this.testRunner = testRunner;
    }

    public testRunner: string;

    public publish(resultFiles, mergeResults, platform, config, runTitle, publishRunAttachments) {

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
            properties['resultFiles'] = resultFiles;
        }

        command('results.publish', properties, '');
    }
}

//-----------------------------------------------------
// Code Coverage Publisher
//-----------------------------------------------------
export class CodeCoveragePublisher {
    constructor() {
    }
    public publish(codeCoverageTool, summaryFileLocation, reportDirectory, additionalCodeCoverageFiles) {

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
            properties['additionalcodecoveragefiles'] = additionalCodeCoverageFiles;
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
// Tools
//-----------------------------------------------------
exports.TaskCommand = tcm.TaskCommand;
exports.commandFromString = tcm.commandFromString;
exports.ToolRunner = trm.ToolRunner;
trm.debug = debug;


