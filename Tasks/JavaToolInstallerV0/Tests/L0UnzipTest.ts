import mockanswer = require('azure-pipelines-task-lib/mock-answer');
import mockrun = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

var Q = require('q');

const taskPath = path.join(__dirname, '..', 'javatoolinstaller.js');
const srcPath = 'source/foo.zip';
const destDir = '/destDir';

// task parameters
const tr: mockrun.TaskMockRunner = new mockrun.TaskMockRunner(taskPath);
tr.setInput("versionSpec", "8.1");
tr.setInput("jdkSourceOption", "Local Directory");
tr.setInput("jdkFile", srcPath);
tr.setInput("jdkDestinationDirectory", destDir);
tr.setInput("cleanDestinationDirectory", "false");
tr.setInput("jdkArchitectureOption", "x64");

// set windir
process.env.windir = 'windir';
process.env['TOOLDIRECTORY'] = 'toolsdirectory';

// provide answers for task mock
const a: mockanswer.TaskLibAnswers = <mockanswer.TaskLibAnswers>{
    exist: {[destDir]: true},
    which: {'windir\\system32\\chcp.com': 'windir\\system32\\chcp.com'},
    checkPath: {'windir\\system32\\chcp.com': true },
    find: {[destDir]: [destDir]},
    rmRF: { },
    osType: {'osType': 'Win32'},
    stats: {[destDir]: {'isDirectory':'true'}, 'source\\foo.zip': {'isFile':'true'}, '/destDir/foo': {'isDirectory':'true'}},
};
tr.setAnswers(a);

// toolrunner that mimicks modification of the directory structure following a powershell unzip command
var MockToolRunner = function (tool) {
    var _tool;
    var _line;
    var _args;
    
    this.init = function(tool) {
        this._tool = tool;
    };

    this.arg = function (args) {
        this._args = args;
        return this;
    };

    this.line = function (val) {
        this._line = val;
        return this;
    };

    this.exec = function (options) {
        var _this = this;
        var defer = Q.defer();
        console.log('exec: ' + _this._tool + ' line: ' + _this._line + ' args: ' + _this._args);

        // Simulate some asynchronous event through timer
        setTimeout(function() {
            if (_this._tool == 'powershell') {
                // update to pretend an unzip actually occurred
                a.find = {[destDir]: [destDir, '/destDir/foo']};
                console.log('directories updated: ' + a.find[destDir]);
            }
            defer.resolve(0);
        }, 100);
        return defer.promise;
    };

    this.execSync = function(options) {
        console.log('execSync: ' + this._tool + ' line: ' + this._line + ' args: ' + this._args);
        return this;
    };
    
    this.init(tool);
};

tr.registerMockExport('tool', function(tool){
    return new MockToolRunner(tool);
});

// tool mock 
tr.registerMock('vsts-task-tool-lib/tool', {
    debug: function(message) {
        console.log('##debug : ' + message);
    },

    findLocalToolVersions: function(fileName) {
        return null;
    },
    evaluateVersions: function(fileName) {
        return null;
    }
});

tr.run();