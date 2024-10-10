import fs = require('fs');
import path = require('path');
import os = require('os');
import minimatch = require('minimatch');
import util = require('util');
import tcm = require('./taskcommand');
import vm = require('./vault');
import semver = require('semver');
import crypto = require('crypto');

/**
 * Hash table of known variable info. The formatted env var name is the lookup key.
 *
 * The purpose of this hash table is to keep track of known variables. The hash table
 * needs to be maintained for multiple reasons:
 *  1) to distinguish between env vars and job vars
 *  2) to distinguish between secret vars and public
 *  3) to know the real variable name and not just the formatted env var name.
 */
export var _knownVariableMap: { [key: string]: _KnownVariableInfo; } = {};

export var _vault: vm.Vault;
var _commandCorrelationId: string;

//-----------------------------------------------------
// Enums
//-----------------------------------------------------
export enum IssueSource {
    CustomerScript = 'CustomerScript',
    TaskInternal = 'TaskInternal'
}

export enum IssueAuditAction {
    Unknown = 0,
    ShellTasksValidation = 1,
}

//-----------------------------------------------------
// Validation Checks
//-----------------------------------------------------

// async await needs generators in node 4.x+
if (semver.lt(process.versions.node, '4.2.0')) {
    _warning('Tasks require a new agent.  Upgrade your agent or node to 4.2.0 or later', IssueSource.TaskInternal);
}

//-----------------------------------------------------
// String convenience
//-----------------------------------------------------

export function _startsWith(str: string, start: string): boolean {
    return str.slice(0, start.length) == start;
}

export function _endsWith(str: string, end: string): boolean {
    return str.slice(-end.length) == end;
}

export function _truncateBeforeSensitiveKeyword(str: string, sensitiveKeywordsPattern: RegExp): string {
    if (!str) {
        return str;
    }

    const index = str.search(sensitiveKeywordsPattern);

    if (index <= 0) {
        return str;
    }

    return `${str.substring(0, index)}...`;
}

//-----------------------------------------------------
// General Helpers
//-----------------------------------------------------

let _outStream = process.stdout;
let _errStream = process.stderr;

export function _writeLine(str: string): void {
    _outStream.write(str + os.EOL);
}

export function _setStdStream(stdStream): void {
    _outStream = stdStream;
}

export function _setErrStream(errStream): void {
    _errStream = errStream;
}

//-----------------------------------------------------
// Loc Helpers
//-----------------------------------------------------

let _locStringCache: { [key: string]: string } = {};
let _resourceFiles: { [key: string]: string } = {};
let _libResourceFileLoaded: boolean = false;
let _resourceCulture: string = 'en-US';

function _loadResJson(resjsonFile: string): any {
    var resJson: any;
    if (_exist(resjsonFile)) {
        var resjsonContent = fs.readFileSync(resjsonFile, 'utf8').toString();
        // remove BOM
        if (resjsonContent.indexOf('\uFEFF') == 0) {
            resjsonContent = resjsonContent.slice(1);
        }

        try {
            resJson = JSON.parse(resjsonContent);
        }
        catch (err) {
            _debug('unable to parse resjson with err: ' + err.message);
        }
    }
    else {
        _debug('.resjson file not found: ' + resjsonFile);
    }

    return resJson;
}

function _loadLocStrings(resourceFile: string, culture: string): { [key: string]: string; } {
    var locStrings: {
        [key: string]: string
    } = {};

    if (_exist(resourceFile)) {
        var resourceJson = require(resourceFile);
        if (resourceJson && resourceJson.hasOwnProperty('messages')) {
            var locResourceJson: any;
            // load up resource resjson for different culture

            var localizedResourceFile = path.join(path.dirname(resourceFile), 'Strings', 'resources.resjson');
            var upperCulture = culture.toUpperCase();
            var cultures: string[] = [];
            try { cultures = fs.readdirSync(localizedResourceFile); }
            catch (ex) { }
            for (var i = 0; i < cultures.length; i++) {
                if (cultures[i].toUpperCase() == upperCulture) {
                    localizedResourceFile = path.join(localizedResourceFile, cultures[i], 'resources.resjson');
                    if (_exist(localizedResourceFile)) {
                        locResourceJson = _loadResJson(localizedResourceFile);
                    }

                    break;
                }
            }

            for (var key in resourceJson.messages) {
                if (locResourceJson && locResourceJson.hasOwnProperty('loc.messages.' + key)) {
                    locStrings[key] = locResourceJson['loc.messages.' + key];
                }
                else {
                    locStrings[key] = resourceJson.messages[key];
                }
            }
        }
    }
    else {
        _warning('LIB_ResourceFile does not exist', IssueSource.TaskInternal);
    }

    return locStrings;
}

/**
 * Sets the location of the resources json.  This is typically the task.json file.
 * Call once at the beginning of the script before any calls to loc.
 * @param     path      Full path to the json.
 * @param     ignoreWarnings  Won't throw warnings if path already set.
 * @returns   void
 */
export function _setResourcePath(path: string, ignoreWarnings: boolean = false): void {
    if (process.env['TASKLIB_INPROC_UNITS']) {
        _resourceFiles = {};
        _libResourceFileLoaded = false;
        _locStringCache = {};
        _resourceCulture = 'en-US';
    }

    if (!_resourceFiles[path]) {
        _checkPath(path, 'resource file path');
        _resourceFiles[path] = path;
        _debug('adding resource file: ' + path);

        _resourceCulture = _getVariable('system.culture') || _resourceCulture;
        var locStrs: { [key: string]: string; } = _loadLocStrings(path, _resourceCulture);
        for (var key in locStrs) {
            //cache loc string
            _locStringCache[key] = locStrs[key];
        }

    }
    else {
        if (ignoreWarnings) {
           
        } else {
            _warning(_loc('LIB_ResourceFileAlreadySet', path), IssueSource.TaskInternal);
        }
    }
}

/**
 * Gets the localized string from the json resource file.  Optionally formats with additional params.
 *
 * @param     key      key of the resources string in the resource file
 * @param     param    additional params for formatting the string
 * @returns   string
 */
export function _loc(key: string, ...param: any[]): string {
    if (!_libResourceFileLoaded) {
        // merge loc strings from azure-pipelines-task-lib.
        var libResourceFile = path.join(__dirname, 'lib.json');
        var libLocStrs = _loadLocStrings(libResourceFile, _resourceCulture);
        for (var libKey in libLocStrs) {
            //cache azure-pipelines-task-lib loc string
            _locStringCache[libKey] = libLocStrs[libKey];
        }

        _libResourceFileLoaded = true;
    }

    var locString;;
    if (_locStringCache.hasOwnProperty(key)) {
        locString = _locStringCache[key];
    }
    else {
        if (Object.keys(_resourceFiles).length <= 0) {
            _warning(`Resource file haven't been set, can't find loc string for key: ${key}`, IssueSource.TaskInternal);
        }
        else {
            _warning(`Can't find loc string for key: ${key}`);
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

/**
 * Gets a variable value that is defined on the build/release definition or set at runtime.
 *
 * @param     name     name of the variable to get
 * @returns   string
 */
export function _getVariable(name: string): string | undefined {
    let varval: string | undefined;

    // get the metadata
    let info: _KnownVariableInfo | undefined;
    let key: string = _getVariableKey(name);
    if (_knownVariableMap.hasOwnProperty(key)) {
        info = _knownVariableMap[key];
    }

    if (info && info.secret) {
        // get the secret value
        varval = _vault.retrieveSecret('SECRET_' + key);
    }
    else {
        // get the public value
        varval = process.env[key];

        // fallback for pre 2.104.1 agent
        if (!varval && name.toUpperCase() == 'AGENT.JOBSTATUS') {
            varval = process.env['agent.jobstatus'];
        }
    }

    _debug(name + '=' + varval);
    return varval;
}

export function _getVariableKey(name: string): string {
    if (!name) {
        throw new Error(_loc('LIB_ParameterIsRequired', 'name'));
    }

    return name.replace(/\./g, '_').replace(/ /g, '_').toUpperCase();
}

/**
 * Used to store the following information about job variables:
 *  1) the real variable name (not the formatted environment variable name)
 *  2) whether the variable is a secret variable
 */
export interface _KnownVariableInfo {
    name: string;
    secret: boolean;
}

//-----------------------------------------------------
// Cmd Helpers
//-----------------------------------------------------

export function _command(command: string, properties: any, message: string) {
    var taskCmd = new tcm.TaskCommand(command, properties, message);
    _writeLine(taskCmd.toString());
}

export function _warning(
    message: string,
    source: IssueSource = IssueSource.TaskInternal,
    auditAction?: IssueAuditAction
): void {
    _command(
        'task.issue',
        {
            'type': 'warning',
            'source': source,
            'correlationId': _commandCorrelationId,
            'auditAction': auditAction
        },
        message
    );
}

export function _error(
    message: string,
    source: IssueSource = IssueSource.TaskInternal,
    auditAction?: IssueAuditAction
): void {
    _command(
        'task.issue',
        {
            'type': 'error',
            'source': source,
            'correlationId': _commandCorrelationId,
            'auditAction': auditAction
        },
        message
    );
}

const debugMode = _getVariable('system.debug')?.toLowerCase() === 'true';
const shouldCheckDebugMode = _getVariable('DistributedTask.Tasks.Node.SkipDebugLogsWhenDebugModeOff')?.toLowerCase() === 'true';

export function _debug(message: string): void {
    if (
        !shouldCheckDebugMode
        || (shouldCheckDebugMode && debugMode)
    ) {
        _command('task.debug', null, message);
    }
}

// //-----------------------------------------------------
// // Disk Functions
// //-----------------------------------------------------

/**
 * Returns whether a path exists.
 *
 * @param     path      path to check
 * @returns   boolean
 */
export function _exist(path: string): boolean {
    var exist = false;
    try {
        exist = !!(path && fs.statSync(path) != null);
    } catch (err) {
        if (err && err.code === 'ENOENT') {
            exist = false;
        } else {
            throw err;
        }
    }
    return exist;
}

/**
 * Checks whether a path exists.
 * If the path does not exist, it will throw.
 *
 * @param     p         path to check
 * @param     name      name only used in error message to identify the path
 * @returns   void
 */
export function _checkPath(p: string, name: string): void {
    _debug('check path : ' + p);
    if (!_exist(p)) {
        throw new Error(_loc('LIB_PathNotFound', name, p));
    }
}

/**
 * Returns path of a tool had the tool actually been invoked.  Resolves via paths.
 * If you check and the tool does not exist, it will throw.
 *
 * @param     tool       name of the tool
 * @param     check      whether to check if tool exists
 * @returns   string
 */
export function _which(tool: string, check?: boolean): string {
    if (!tool) {
        throw new Error('parameter \'tool\' is required');
    }

    // recursive when check=true
    if (check) {
        let result: string = _which(tool, false);
        if (result) {
            return result;
        }
        else {
            if (process.platform == 'win32') {
                throw new Error(_loc('LIB_WhichNotFound_Win', tool));
            }
            else {
                throw new Error(_loc('LIB_WhichNotFound_Linux', tool));
            }
        }
    }

    _debug(`which '${tool}'`);
    try {
        // build the list of extensions to try
        let extensions: string[] = [];
        if (process.platform == 'win32' && process.env['PATHEXT']) {
            for (let extension of process.env['PATHEXT'].split(path.delimiter)) {
                if (extension) {
                    extensions.push(extension);
                }
            }
        }

        // if it's rooted, return it if exists. otherwise return empty.
        if (_isRooted(tool)) {
            let filePath: string = _tryGetExecutablePath(tool, extensions);
            if (filePath) {
                _debug(`found: '${filePath}'`);
                return filePath;
            }

            _debug('not found');
            return '';
        }

        // if any path separators, return empty
        if (tool.indexOf('/') >= 0 || (process.platform == 'win32' && tool.indexOf('\\') >= 0)) {
            _debug('not found');
            return '';
        }

        // build the list of directories
        //
        // Note, technically "where" checks the current directory on Windows. From a task lib perspective,
        // it feels like we should not do this. Checking the current directory seems like more of a use
        // case of a shell, and the which() function exposed by the task lib should strive for consistency
        // across platforms.
        let directories: string[] = [];
        if (process.env['PATH']) {
            for (let p of process.env['PATH'].split(path.delimiter)) {
                if (p) {
                    directories.push(p);
                }
            }
        }

        // return the first match
        for (let directory of directories) {
            let filePath = _tryGetExecutablePath(directory + path.sep + tool, extensions);
            if (filePath) {
                _debug(`found: '${filePath}'`);
                return filePath;
            }
        }

        _debug('not found');
        return '';
    }
    catch (err) {
        throw new Error(_loc('LIB_OperationFailed', 'which', err.message));
    }
}

/**
 * Best effort attempt to determine whether a file exists and is executable.
 * @param filePath    file path to check
 * @param extensions  additional file extensions to try
 * @return if file exists and is executable, returns the file path. otherwise empty string.
 */
function _tryGetExecutablePath(filePath: string, extensions: string[]): string {
    try {
        // test file exists
        let stats: fs.Stats = fs.statSync(filePath);
        if (stats.isFile()) {
            if (process.platform == 'win32') {
                // on Windows, test for valid extension
                let isExecutable = false;
                let fileName = path.basename(filePath);
                let dotIndex = fileName.lastIndexOf('.');
                if (dotIndex >= 0) {
                    let upperExt = fileName.substr(dotIndex).toUpperCase();
                    if (extensions.some(validExt => validExt.toUpperCase() == upperExt)) {
                        return filePath;
                    }
                }
            }
            else {
                if (isUnixExecutable(stats)) {
                    return filePath;
                }
            }
        }
    }
    catch (err) {
        if (err.code != 'ENOENT') {
            _debug(`Unexpected error attempting to determine if executable file exists '${filePath}': ${err}`);
        }
    }

    // try each extension
    let originalFilePath = filePath;
    for (let extension of extensions) {
        let found = false;
        let filePath = originalFilePath + extension;
        try {
            let stats: fs.Stats = fs.statSync(filePath);
            if (stats.isFile()) {
                if (process.platform == 'win32') {
                    // preserve the case of the actual file (since an extension was appended)
                    try {
                        let directory = path.dirname(filePath);
                        let upperName = path.basename(filePath).toUpperCase();
                        for (let actualName of fs.readdirSync(directory)) {
                            if (upperName == actualName.toUpperCase()) {
                                filePath = path.join(directory, actualName);
                                break;
                            }
                        }
                    }
                    catch (err) {
                        _debug(`Unexpected error attempting to determine the actual case of the file '${filePath}': ${err}`);
                    }

                    return filePath;
                }
                else {
                    if (isUnixExecutable(stats)) {
                        return filePath;
                    }
                }
            }
        }
        catch (err) {
            if (err.code != 'ENOENT') {
                _debug(`Unexpected error attempting to determine if executable file exists '${filePath}': ${err}`);
            }
        }
    }

    return '';
}

// on Mac/Linux, test the execute bit
//     R   W  X  R  W X R W X
//   256 128 64 32 16 8 4 2 1
function isUnixExecutable(stats: fs.Stats) {
    return (stats.mode & 1) > 0 || ((stats.mode & 8) > 0 && stats.gid === process.getgid()) || ((stats.mode & 64) > 0 && stats.uid === process.getuid());
}

export function _legacyFindFiles_convertPatternToRegExp(pattern: string): RegExp {
    pattern = (process.platform == 'win32' ? pattern.replace(/\\/g, '/') : pattern) // normalize separator on Windows
        .replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') // regex escape - from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
        .replace(/\\\/\\\*\\\*\\\//g, '((\/.+/)|(\/))') // replace directory globstar, e.g. /hello/**/world
        .replace(/\\\*\\\*/g, '.*') // replace remaining globstars with a wildcard that can span directory separators, e.g. /hello/**dll
        .replace(/\\\*/g, '[^\/]*') // replace asterisks with a wildcard that cannot span directory separators, e.g. /hello/*.dll
        .replace(/\\\?/g, '[^\/]') // replace single character wildcards, e.g. /hello/log?.dll
    pattern = `^${pattern}$`;
    let flags = process.platform == 'win32' ? 'i' : '';
    return new RegExp(pattern, flags);
}

//-----------------------------------------------------
// Matching helpers
//-----------------------------------------------------

export interface _MatchOptions {
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

export function _cloneMatchOptions(matchOptions: _MatchOptions): _MatchOptions {
    return <_MatchOptions>{
        debug: matchOptions.debug,
        nobrace: matchOptions.nobrace,
        noglobstar: matchOptions.noglobstar,
        dot: matchOptions.dot,
        noext: matchOptions.noext,
        nocase: matchOptions.nocase,
        nonull: matchOptions.nonull,
        matchBase: matchOptions.matchBase,
        nocomment: matchOptions.nocomment,
        nonegate: matchOptions.nonegate,
        flipNegate: matchOptions.flipNegate
    };
}

export interface _PatternFindInfo {
    /** Adjusted pattern to use. Unrooted patterns are typically rooted using the default info, although this is not true for match-base scenarios. */
    adjustedPattern: string,

    /** Path interpreted from the pattern to call find() on. */
    findPath: string,

    /** Indicates whether to call stat() or find(). When all path segemnts in the pattern are literal, there is no need to call find(). */
    statOnly: boolean,
}

export function _getFindInfoFromPattern(defaultRoot: string, pattern: string, matchOptions: _MatchOptions): _PatternFindInfo {
    // parameter validation
    if (!defaultRoot) {
        throw new Error('getFindRootFromPattern() parameter defaultRoot cannot be empty');
    }

    if (!pattern) {
        throw new Error('getFindRootFromPattern() parameter pattern cannot be empty');
    }

    if (!matchOptions.nobrace) {
        throw new Error('getFindRootFromPattern() expected matchOptions.nobrace to be true');
    }

    // for the sake of determining the findPath, pretend nocase=false
    matchOptions = _cloneMatchOptions(matchOptions);
    matchOptions.nocase = false;

    // check if basename only and matchBase=true
    if (matchOptions.matchBase &&
        !_isRooted(pattern) &&
        (process.platform == 'win32' ? pattern.replace(/\\/g, '/') : pattern).indexOf('/') < 0) {

        return <_PatternFindInfo>{
            adjustedPattern: pattern, // for basename only scenarios, do not root the pattern
            findPath: defaultRoot,
            statOnly: false,
        };
    }

    // the technique applied by this function is to use the information on the Minimatch object determine
    // the findPath. Minimatch breaks the pattern into path segments, and exposes information about which
    // segments are literal vs patterns.
    //
    // note, the technique currently imposes a limitation for drive-relative paths with a glob in the
    // first segment, e.g. C:hello*/world. it's feasible to overcome this limitation, but is left unsolved
    // for now.
    let minimatchObj = new minimatch.Minimatch(pattern, matchOptions);

    // the "set" property is an array of arrays of parsed path segment info. the outer array should only
    // contain one item, otherwise something went wrong. brace expansion can result in multiple arrays,
    // but that should be turned off by the time this function is reached.
    if (minimatchObj.set.length != 1) {
        throw new Error('getFindRootFromPattern() expected Minimatch(...).set.length to be 1. Actual: ' + minimatchObj.set.length);
    }

    let literalSegments: string[] = [];
    for (let parsedSegment of minimatchObj.set[0]) {
        if (typeof parsedSegment == 'string') {
            // the item is a string when the original input for the path segment does not contain any
            // unescaped glob characters.
            //
            // note, the string here is already unescaped (i.e. glob escaping removed), so it is ready
            // to pass to find() as-is. for example, an input string 'hello\\*world' => 'hello*world'.
            literalSegments.push(parsedSegment);
            continue;
        }

        break;
    }

    // join the literal segments back together. Minimatch converts '\' to '/' on Windows, then squashes
    // consequetive slashes, and finally splits on slash. this means that UNC format is lost, but can
    // be detected from the original pattern.
    let joinedSegments = literalSegments.join('/');
    if (joinedSegments && process.platform == 'win32' && _startsWith(pattern.replace(/\\/g, '/'), '//')) {
        joinedSegments = '/' + joinedSegments; // restore UNC format
    }

    // determine the find path
    let findPath: string;
    if (_isRooted(pattern)) { // the pattern was rooted
        findPath = joinedSegments;
    }
    else if (joinedSegments) { // the pattern was not rooted, and literal segments were found
        findPath = _ensureRooted(defaultRoot, joinedSegments);
    }
    else { // the pattern was not rooted, and no literal segments were found
        findPath = defaultRoot;
    }

    // clean up the path
    if (findPath) {
        findPath = _getDirectoryName(_ensureRooted(findPath, '_')); // hack to remove unnecessary trailing slash
        findPath = _normalizeSeparators(findPath); // normalize slashes
    }

    return <_PatternFindInfo>{
        adjustedPattern: _ensurePatternRooted(defaultRoot, pattern),
        findPath: findPath,
        statOnly: literalSegments.length == minimatchObj.set[0].length,
    };
}

export function _ensurePatternRooted(root: string, p: string) {
    if (!root) {
        throw new Error('ensurePatternRooted() parameter "root" cannot be empty');
    }

    if (!p) {
        throw new Error('ensurePatternRooted() parameter "p" cannot be empty');
    }

    if (_isRooted(p)) {
        return p;
    }

    // normalize root
    root = _normalizeSeparators(root);

    // escape special glob characters
    root = (process.platform == 'win32' ? root : root.replace(/\\/g, '\\\\')) // escape '\' on OSX/Linux
        .replace(/(\[)(?=[^\/]+\])/g, '[[]') // escape '[' when ']' follows within the path segment
        .replace(/\?/g, '[?]') // escape '?'
        .replace(/\*/g, '[*]') // escape '*'
        .replace(/\+\(/g, '[+](') // escape '+('
        .replace(/@\(/g, '[@](') // escape '@('
        .replace(/!\(/g, '[!]('); // escape '!('

    return _ensureRooted(root, p);
}

//-------------------------------------------------------------------
// Populate the vault with sensitive data.  Inputs and Endpoints
//-------------------------------------------------------------------

export function _loadData(): void {
    // in agent, prefer TempDirectory then workFolder.
    // In interactive dev mode, it won't be
    let keyPath: string = _getVariable("agent.TempDirectory") || _getVariable("agent.workFolder") || process.cwd();
    _vault = new vm.Vault(keyPath);
    _knownVariableMap = {};
    _debug('loading inputs and endpoints');
    let loaded: number = 0;
    for (let envvar in process.env) {
        if (_startsWith(envvar, 'INPUT_') ||
            _startsWith(envvar, 'ENDPOINT_AUTH_') ||
            _startsWith(envvar, 'SECUREFILE_TICKET_') ||
            _startsWith(envvar, 'SECRET_') ||
            _startsWith(envvar, 'VSTS_TASKVARIABLE_')) {

            // Record the secret variable metadata. This is required by getVariable to know whether
            // to retrieve the value from the vault. In a 2.104.1 agent or higher, this metadata will
            // be overwritten when the VSTS_SECRET_VARIABLES env var is processed below.
            if (_startsWith(envvar, 'SECRET_')) {
                let variableName: string = envvar.substring('SECRET_'.length);
                if (variableName) {
                    // This is technically not the variable name (has underscores instead of dots),
                    // but it's good enough to make getVariable work in a pre-2.104.1 agent where
                    // the VSTS_SECRET_VARIABLES env var is not defined.
                    _knownVariableMap[_getVariableKey(variableName)] = <_KnownVariableInfo>{ name: variableName, secret: true };
                }
            }

            // store the secret
            var value = process.env[envvar];
            if (value) {
                ++loaded;
                _debug('loading ' + envvar);
                _vault.storeSecret(envvar, value);
                delete process.env[envvar];
            }
        }
    }
    _debug('loaded ' + loaded);

    let correlationId = process.env["COMMAND_CORRELATION_ID"];
    delete process.env["COMMAND_CORRELATION_ID"];
    _commandCorrelationId = correlationId ? String(correlationId) : "";

    // store public variable metadata
    let names: string[];
    try {
        names = JSON.parse(process.env['VSTS_PUBLIC_VARIABLES'] || '[]');
    }
    catch (err) {
        throw new Error('Failed to parse VSTS_PUBLIC_VARIABLES as JSON. ' + err); // may occur during interactive testing
    }

    names.forEach((name: string) => {
        _knownVariableMap[_getVariableKey(name)] = <_KnownVariableInfo>{ name: name, secret: false };
    });
    delete process.env['VSTS_PUBLIC_VARIABLES'];

    // store secret variable metadata
    try {
        names = JSON.parse(process.env['VSTS_SECRET_VARIABLES'] || '[]');
    }
    catch (err) {
        throw new Error('Failed to parse VSTS_SECRET_VARIABLES as JSON. ' + err); // may occur during interactive testing
    }

    names.forEach((name: string) => {
        _knownVariableMap[_getVariableKey(name)] = <_KnownVariableInfo>{ name: name, secret: true };
    });
    delete process.env['VSTS_SECRET_VARIABLES'];

    // avoid loading twice (overwrites .taskkey)
    global['_vsts_task_lib_loaded'] = true;
}

//--------------------------------------------------------------------------------
// Internal path helpers.
//--------------------------------------------------------------------------------

/**
 * Defines if path is unc-path.
 *
 * @param path  a path to a file.
 * @returns     true if path starts with double backslash, otherwise returns false.
 */
export function _isUncPath(path: string) {
    return /^\\\\[^\\]/.test(path);
}

export function _ensureRooted(root: string, p: string) {
    if (!root) {
        throw new Error('ensureRooted() parameter "root" cannot be empty');
    }

    if (!p) {
        throw new Error('ensureRooted() parameter "p" cannot be empty');
    }

    if (_isRooted(p)) {
        return p;
    }

    if (process.platform == 'win32' && root.match(/^[A-Z]:$/i)) { // e.g. C:
        return root + p;
    }

    // ensure root ends with a separator
    if (_endsWith(root, '/') || (process.platform == 'win32' && _endsWith(root, '\\'))) {
        // root already ends with a separator
    }
    else {
        root += path.sep; // append separator
    }

    return root + p;
}

/**
 * Determines the parent path and trims trailing slashes (when safe). Path separators are normalized
 * in the result. This function works similar to the .NET System.IO.Path.GetDirectoryName() method.
 * For example, C:\hello\world\ returns C:\hello\world (trailing slash removed). Returns empty when
 * no higher directory can be determined.
 */
export function _getDirectoryName(p: string): string {
    // short-circuit if empty
    if (!p) {
        return '';
    }

    // normalize separators
    p = _normalizeSeparators(p);

    // on Windows, the goal of this function is to match the behavior of
    // [System.IO.Path]::GetDirectoryName(), e.g.
    //      C:/             =>
    //      C:/hello        => C:\
    //      C:/hello/       => C:\hello
    //      C:/hello/world  => C:\hello
    //      C:/hello/world/ => C:\hello\world
    //      C:              =>
    //      C:hello         => C:
    //      C:hello/        => C:hello
    //      /               =>
    //      /hello          => \
    //      /hello/         => \hello
    //      //hello         =>
    //      //hello/        =>
    //      //hello/world   =>
    //      //hello/world/  => \\hello\world
    //
    // unfortunately, path.dirname() can't simply be used. for example, on Windows
    // it yields different results from Path.GetDirectoryName:
    //      C:/             => C:/
    //      C:/hello        => C:/
    //      C:/hello/       => C:/
    //      C:/hello/world  => C:/hello
    //      C:/hello/world/ => C:/hello
    //      C:              => C:
    //      C:hello         => C:
    //      C:hello/        => C:
    //      /               => /
    //      /hello          => /
    //      /hello/         => /
    //      //hello         => /
    //      //hello/        => /
    //      //hello/world   => //hello/world
    //      //hello/world/  => //hello/world/
    //      //hello/world/again => //hello/world/
    //      //hello/world/again/ => //hello/world/
    //      //hello/world/again/again => //hello/world/again
    //      //hello/world/again/again/ => //hello/world/again
    if (process.platform == 'win32') {
        if (/^[A-Z]:\\?[^\\]+$/i.test(p)) { // e.g. C:\hello or C:hello
            return p.charAt(2) == '\\' ? p.substring(0, 3) : p.substring(0, 2);
        }
        else if (/^[A-Z]:\\?$/i.test(p)) { // e.g. C:\ or C:
            return '';
        }

        let lastSlashIndex = p.lastIndexOf('\\');
        if (lastSlashIndex < 0) { // file name only
            return '';
        }
        else if (p == '\\') { // relative root
            return '';
        }
        else if (lastSlashIndex == 0) { // e.g. \\hello
            return '\\';
        }
        else if (/^\\\\[^\\]+(\\[^\\]*)?$/.test(p)) { // UNC root, e.g. \\hello or \\hello\ or \\hello\world
            return '';
        }

        return p.substring(0, lastSlashIndex);  // e.g. hello\world => hello or hello\world\ => hello\world
        // note, this means trailing slashes for non-root directories
        // (i.e. not C:\, \, or \\unc\) will simply be removed.
    }

    // OSX/Linux
    if (p.indexOf('/') < 0) { // file name only
        return '';
    }
    else if (p == '/') {
        return '';
    }
    else if (_endsWith(p, '/')) {
        return p.substring(0, p.length - 1);
    }

    return path.dirname(p);
}

/**
 * On OSX/Linux, true if path starts with '/'. On Windows, true for paths like:
 * \, \hello, \\hello\share, C:, and C:\hello (and corresponding alternate separator cases).
 */
export function _isRooted(p: string): boolean {
    p = _normalizeSeparators(p);
    if (!p) {
        throw new Error('isRooted() parameter "p" cannot be empty');
    }

    if (process.platform == 'win32') {
        return _startsWith(p, '\\') || // e.g. \ or \hello or \\hello
            /^[A-Z]:/i.test(p);      // e.g. C: or C:\hello
    }

    return _startsWith(p, '/'); // e.g. /hello
}

export function _normalizeSeparators(p: string): string {
    p = p || '';
    if (process.platform == 'win32') {
        // convert slashes on Windows
        p = p.replace(/\//g, '\\');

        // remove redundant slashes
        let isUnc = /^\\\\+[^\\]/.test(p); // e.g. \\hello
        return (isUnc ? '\\' : '') + p.replace(/\\\\+/g, '\\'); // preserve leading // for UNC
    }

    // remove redundant slashes
    return p.replace(/\/\/+/g, '/');
}

//-----------------------------------------------------
// Expose proxy information to vsts-node-api
//-----------------------------------------------------
export function _exposeProxySettings(): void {
    let proxyUrl: string | undefined = _getVariable('Agent.ProxyUrl');
    if (proxyUrl && proxyUrl.length > 0) {
        let proxyUsername: string | undefined = _getVariable('Agent.ProxyUsername');
        let proxyPassword: string | undefined = _getVariable('Agent.ProxyPassword');
        let proxyBypassHostsJson: string | undefined = _getVariable('Agent.ProxyBypassList');

        global['_vsts_task_lib_proxy_url'] = proxyUrl;
        global['_vsts_task_lib_proxy_username'] = proxyUsername;
        global['_vsts_task_lib_proxy_bypass'] = proxyBypassHostsJson;
        global['_vsts_task_lib_proxy_password'] = _exposeTaskLibSecret('proxy', proxyPassword || '');

        _debug('expose agent proxy configuration.')
        global['_vsts_task_lib_proxy'] = true;
    }
}

//-----------------------------------------------------
// Expose certificate information to vsts-node-api
//-----------------------------------------------------
export function _exposeCertSettings(): void {
    let ca: string | undefined = _getVariable('Agent.CAInfo');
    if (ca) {
        global['_vsts_task_lib_cert_ca'] = ca;
    }

    let clientCert = _getVariable('Agent.ClientCert');
    if (clientCert) {
        let clientCertKey: string | undefined = _getVariable('Agent.ClientCertKey');
        let clientCertArchive: string | undefined = _getVariable('Agent.ClientCertArchive');
        let clientCertPassword: string | undefined = _getVariable('Agent.ClientCertPassword');

        global['_vsts_task_lib_cert_clientcert'] = clientCert;
        global['_vsts_task_lib_cert_key'] = clientCertKey;
        global['_vsts_task_lib_cert_archive'] = clientCertArchive;
        global['_vsts_task_lib_cert_passphrase'] = _exposeTaskLibSecret('cert', clientCertPassword || '');
    }

    if (ca || clientCert) {
        _debug('expose agent certificate configuration.')
        global['_vsts_task_lib_cert'] = true;
    }

    let skipCertValidation: string = _getVariable('Agent.SkipCertValidation') || 'false';
    if (skipCertValidation) {
        global['_vsts_task_lib_skip_cert_validation'] = skipCertValidation.toUpperCase() === 'TRUE';
    }
}

// We store the encryption key on disk and hold the encrypted content and key file in memory
// return base64encoded<keyFilePath>:base64encoded<encryptedContent>
// downstream vsts-node-api will retrieve the secret later
function _exposeTaskLibSecret(keyFile: string, secret: string): string | undefined {
    if (secret) {
        let encryptKey = crypto.randomBytes(256);
        let cipher = crypto.createCipher("aes-256-ctr", encryptKey);
        let encryptedContent = cipher.update(secret, "utf8", "hex");
        encryptedContent += cipher.final("hex");

        let storageFile = path.join(_getVariable('Agent.TempDirectory') || _getVariable("agent.workFolder") || process.cwd(), keyFile);
        fs.writeFileSync(storageFile, encryptKey.toString('base64'), { encoding: 'utf8' });

        return new Buffer(storageFile).toString('base64') + ':' + new Buffer(encryptedContent).toString('base64');
    }
}

export function isSigPipeError(e: NodeJS.ErrnoException): e is NodeJS.ErrnoException {
    if (!e || typeof e !== 'object') {
        return false;
    }

    return e.code === 'EPIPE' && e.syscall?.toUpperCase() === 'WRITE';
}