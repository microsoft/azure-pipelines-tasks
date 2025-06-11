import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import assert = require('assert');

let taskPath = path.join(__dirname, '..', 'dotnetcore.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('command', "publish");
tmr.setInput('projects', "web/project.json");
tmr.setInput('publishWebProjects', "false");
tmr.setInput('arguments', "--configuration release --output /usr/out");
tmr.setInput('zipAfterPublish', "true");
tmr.setInput('modifyOutputPath', "false");
// tmr.setInput('zipAfterPublishCreateDirectory', "true"); // Removed: now controlled by feature flag

// Mock file system operations for testing zip functionality
const mockFs = {
    createWriteStream: function(filePath) {
        console.log("Creating write stream for: " + filePath);
        const events = {};
        return {
            on: (event, callback) => {
                events[event] = callback;
                return this;
            },
            end: () => {
                console.log("Closing write stream for: " + filePath);
                events['close']();
            }
        };
    },
    mkdirSync: function(p) {
        console.log("Creating directory: " + p);
    },
    renameSync: function(oldPath, newPath) {
        console.log("Moving file from: " + oldPath + " to: " + newPath);
    },
    existsSync: function(filePath) {
        return true;
    },
    readFileSync: function() {
        return "";
    },
    statSync: function() {
        return {
            isFile: () => false,
            isDirectory: () => true
        };
    },
    lstatSync: function() {
        return {
            isDirectory: () => true
        };
    }
};

// Mock archiver
const mockArchiver = function() {
    return {
        pipe: function() { return this; },
        directory: function() { return this; },
        finalize: function() { return this; }
    };
};

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": { "dotnet": "dotnet" },
    "checkPath": { "dotnet": true },
    "exist": {
        "/usr/out": true
    },
    "exec": {
        "dotnet publish web/project.json --configuration release --output /usr/out": {
            "code": 0,
            "stdout": "published web without adding project name to path\n",
            "stderr": ""
        }
    },
    "findMatch": {
        "web/project.json": ["web/project.json"]
    },
    "rmRF": {
        "/usr/out": {
            "success": true
        }
    }
};

tmr.setAnswers(a);

// Mock getPipelineFeature to return false for legacy behavior (create directory)
const mockTl = {
    ...require('azure-pipelines-task-lib/task'),
    getPipelineFeature: function(feature: string): boolean {
        if (feature === 'DotNetCoreCLIZipAfterPublishSimplified') {
            return false; // Disable simplified behavior for this test (use legacy behavior)
        }
        return false;
    }
};

tmr.registerMock('azure-pipelines-task-lib/task', mockTl);
tmr.registerMock('fs', Object.assign({}, fs, mockFs));
tmr.registerMock('archiver', mockArchiver);
tmr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));

tmr.run();