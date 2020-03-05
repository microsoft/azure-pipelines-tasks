import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');

let taskPath = path.join(__dirname, '..', 'main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("command", "get");

process.env["MOCK_NORMALIZE_SLASHES"] = "true";

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "exec": {
        "C:\\somedir\\go get": {
            "code": 0,
            "stdout": "",
            "stderr": ""
        },
    },
    "which": {
        "go": "C:\\somedir\\go"
    },
    "checkPath": {
        "C:\\somedir\\go": true
    }
};

tr.setAnswers(a);

tr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));
tr.registerMock('azure-pipelines-task-tool-lib/tool', require('./mock_node_modules/tool'));
tr.run();