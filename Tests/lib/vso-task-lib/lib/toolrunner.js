/// <reference path="../definitions/node.d.ts" />
/// <reference path="../definitions/Q.d.ts" />
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var Q = require('q');
var events = require('events');

function debug(message) {
    if (process.env['TASK_TEST_TRACE']) {
        console.log(message);
    }
}


exports.debug = debug;
;
var ToolRunner = (function (_super) {
    __extends(ToolRunner, _super);
    function ToolRunner(toolPath) {
        debug('toolRunner toolPath: ' + toolPath);
        this.toolPath = toolPath;
        this.args = [];
        this.injectedSuccess = false;
        _super.call(this);
    }
    ToolRunner.prototype._debug = function (message) {
        debug(message);
        this.emit('debug', message);
    };
    ToolRunner.prototype._argStringToArray = function (argString) {
        var args = argString.match(/([^" ]*("[^"]*")[^" ]*)|[^" ]+/g);
        //remove double quotes from each string in args as child_process.spawn() cannot handle literla quotes as part of arguments
        for (var i = 0; i < args.length; i++) {
            args[i] = args[i].replace(/"/g, "");
        }
        return args;
    };
    ToolRunner.prototype.arg = function (val, raw) {
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
    };

    ToolRunner.prototype.exec = function (options) {
        var _this = this;
        var defer = Q.defer();

        console.log(this.toolPath);
        console.log(typeof this.toolPath);

        if (!this.toolPath) {
            console.log('!!!!!!!!!!!!!');
            defer.resolve(null);
            return defer.promise;
        }

        this._debug('exec tool: ' + this.toolPath);

        this._debug('Arguments:');
        this.args.forEach(function (arg) {
            _this._debug('   ' + arg);
        });

        var cmdString = this.toolPath;
        var argString = this.args.join(' ') || '';
        
        if (argString) {
            cmdString += (' ' + argString);
        }
        console.log('[command]' + cmdString);

        var success = process.env['TASK_TEST_FAIL'] ? false : true;
        _this._debug('success:' + success);

        var code = Number(process.env['TASK_TEST_RC'] || 0);
        console.log('RRRCCCC:' + code);
        _this._debug('rc:' + code);
        
        if (success) {
            defer.resolve(code);
        }
        else {
            defer.reject(new Error(_this.toolPath + ' failed with return code: ' + code));
        }

        return defer.promise;
    };
    return ToolRunner;
})(events.EventEmitter);
exports.ToolRunner = ToolRunner;
