var Q = require('q');
var shell = require('shelljs');
var fs = require('fs');
var path = require('path');
var os = require('os');
var minimatch = require('minimatch');
var tcm = require('./taskcommand');
var trm = require('./toolrunner');
(function (TaskResult) {
    TaskResult[TaskResult["Succeeded"] = 0] = "Succeeded";
    TaskResult[TaskResult["Failed"] = 1] = "Failed";
})(exports.TaskResult || (exports.TaskResult = {}));
var TaskResult = exports.TaskResult;
//-----------------------------------------------------
// General Helpers
//-----------------------------------------------------
var _outStream = process.stdout;
var _errStream = process.stderr;
function _writeError(str) {
    console.error(str);
}

function _writeLine(str) {
    console.log(str);
}

function setStdStream(stdStream) {
    _outStream = stdStream;
}

exports.setStdStream = setStdStream;
function setErrStream(errStream) {
    _errStream = errStream;
}

exports.setErrStream = setErrStream;
// back compat: should use setResult
function exit(code) {
    var result = code == 0 ? 'Succeeded' : 'Failed';
    debug('task result: ' + result);
    command('task.complete', { 'result': result }, 'return code: ' + code);
}
exports.exit = exit;
function setResult(result, message) {
    debug('task result: ' + TaskResult[result]);
    command('task.complete', { 'result': TaskResult[result] }, message);
}
exports.setResult = setResult;

//-----------------------------------------------------
// Input Helpers
//-----------------------------------------------------
function getVariable(name) {
    var varval = process.env[name.replace('.', '_').toUpperCase()];
    debug(name + '=' + varval);
    return varval;
}
exports.getVariable = getVariable;

function setVariable(name, val) {
    if (!name) {
        _writeError('name required: ' + name);
        exit(1);
    }
    var varValue = val || '';
    process.env[name.replace('.', '_').toUpperCase()] = varValue;
    debug('set ' + name + '=' + varValue);
    command('task.setvariable', { 'variable': name || '' }, varValue);
}
exports.setVariable = setVariable;

function getInput(name, required) {
    var inval = process.env['INPUT_' + name.replace(' ', '_').toUpperCase()];
    if (required && !inval) {
        _writeError('Input required: ' + name);
        exit(1);
    }
    debug(name + '=' + inval);
    return inval;
}
exports.getInput = getInput;

function getDelimitedInput(name, delim, required) {
    var inval = getInput(name, required);
    if (!inval) {
        return [];
    }
    return inval.split(delim);
}
exports.getDelimitedInput = getDelimitedInput;

function getPathInput(name, required, check) {
    var inval = process.env['INPUT_' + name.replace(' ', '_').toUpperCase()];
    if (required && !inval) {
        _writeError('Input required: ' + name);
        exit(1);
    }
    if (check) {
        checkPath(inval, name);
    }
    debug(name + '=' + inval);
    return inval;
}
exports.getPathInput = getPathInput;

//-----------------------------------------------------
// Endpoint Helpers
//-----------------------------------------------------
function getEndpointUrl(id, optional) {
    var urlval = process.env['ENDPOINT_URL_' + id];
    if (!optional && !urlval) {
        _writeError('Endpoint not present: ' + id);
        exit(1);
    }
    debug(id + '=' + urlval);
    return urlval;
}
exports.getEndpointUrl = getEndpointUrl;
function getEndpointAuthorization(id, optional) {
    var aval = process.env['ENDPOINT_AUTH_' + id];
    if (!optional && !aval) {
        _writeError('Endpoint not present: ' + id);
        exit(1);
    }
    debug(id + '=' + aval);
    var auth;
    try {
        auth = JSON.parse(aval);
    }
    catch (err) {
        _writeError('Invalid endpoint auth: ' + aval);
        exit(1);
    }
    return auth;
}
exports.getEndpointAuthorization = getEndpointAuthorization;

//-----------------------------------------------------
// Cmd Helpers
//-----------------------------------------------------
function command(command, properties, message) {
    var taskCmd = new tcm.TaskCommand(command, properties, message);
    _writeLine(taskCmd.toString());
}
exports.command = command;

function warning(message) {
    command('task.issue', { 'type': 'warning' }, message);
}
exports.warning = warning;

function error(message) {
    command('task.issue', { 'type': 'error' }, message);
}
exports.error = error;

function debug(message) {
    command('task.debug', null, message);
}
exports.debug = debug;

var _argStringToArray = function (argString) {
    var args = argString.match(/([^" ]*("[^"]*")[^" ]*)|[^" ]+/g);
    for (var i = 0; i < args.length; i++) {
        args[i] = args[i].replace(/"/g, "");
    }
    return args;
};
function cd(path) {
    console.log('CWD:' + path);
}
exports.cd = cd;

var pstack = [];
function _peekStack() {
    if (pstack.length > 0) {
        var last
        console.log('CWD:' + pstack[pstack.length - 1]);
    }
}

function pushd(path) {
    pstack.push(path);
}
exports.pushd = pushd;

function popd() {
    pstack.pop();
}
exports.popd = popd;

//------------------------------------------------
// Validation Helpers
//------------------------------------------------
function checkPath(p, name) {
    console.log('check path : ' + p);
}
exports.checkPath = checkPath;

//-----------------------------------------------------
// Shell/File I/O Helpers
// Abstract these away so we can
// - default to good error handling
// - inject system.debug info
// - have option to switch internal impl (shelljs now)
//-----------------------------------------------------
function mkdirP(p) {
    console.log('MKDIR:' + p);
}
exports.mkdirP = mkdirP;

function which(tool, check) {
    console.log('WHICH TOOL: ' + tool);
    var toolPath = process.env['TASK_TEST_WHICH_' + tool.toUpperCase()];
    if (!toolPath) {
        console.log('toolPath is null');
    }

    console.log('toolPath: ' + toolPath + ' ' + check);
    if (check && !toolPath) {
        _writeError('Required tool not found: ' + tool);
        exit(1);
    }

    return toolPath;
}
exports.which = which;

function cp(options, source, dest) {
    console.log('CP:' + source + '->' + dest);
}
exports.cp = cp;

function find(findPath) {
    // TODO: mock out when needed
    var matches = [];
}
exports.find = find;

function rmRF(path) {
    console.log('RM:' + path);
}
exports.rmRF = rmRF;

//-----------------------------------------------------
// Test Publisher
//-----------------------------------------------------
var TestPublisher = (function () {
    function TestPublisher(testRunner) {
        this.testRunner = testRunner;
    }
    TestPublisher.prototype.publish = function (resultFiles, mergeResults, platform, config) {
        if (mergeResults == 'true') {
            _writeLine("Merging test results from multiple files to one test run is not supported on this version of build agent for OSX/Linux, each test result file will be published as a separate test run in VSO/TFS.");
        }
        var properties = {};
        properties['type'] = this.testRunner;
        if (platform) {
            properties['platform'] = platform;
        }
        if (config) {
            properties['config'] = config;
        }
        for (var i = 0; i < resultFiles.length; i++) {
            command('results.publish', properties, resultFiles[i]);
        }
    };
    return TestPublisher;
})();
exports.TestPublisher = TestPublisher;

//-----------------------------------------------------
// Tools
//-----------------------------------------------------
exports.TaskCommand = tcm.TaskCommand;
exports.commandFromString = tcm.commandFromString;
exports.ToolRunner = trm.ToolRunner;
trm.debug = debug;

//-----------------------------------------------------
// Matching helpers
//-----------------------------------------------------

// TODO: mock out when needed

function match(list, pattern, options) {
    return minimatch.match(list, pattern, options);
}
exports.match = match;

function matchFile(list, pattern, options) {
    return minimatch(list, pattern, options);
}
exports.matchFile = matchFile;

function filter(pattern, options) {
    return minimatch.filter(pattern, options);
}
exports.filter = filter;
