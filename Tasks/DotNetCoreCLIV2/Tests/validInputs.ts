import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('./DotnetMockHelper');

let taskPath = path.join(__dirname, '..', 'dotnetcore.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let nmh: util.DotnetMockHelper = new util.DotnetMockHelper(tmr);

tmr.setInput('command', process.env["__command__"]);
tmr.setInput('projects', process.env["__projects__"]);

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": { "dotnet": "dotnet" },
    "checkPath": { "dotnet": true },
    "exec": {
        "dotnet restore web/project.json": {
            "code": 0,
            "stdout": "restored",
            "stderr": ""
        },
        "dotnet restore web2/project.json": {
            "code": 0,
            "stdout": "restored",
            "stderr": ""
        },
        "dotnet restore web.tests/project.json": {
            "code": 0,
            "stdout": "restored",
            "stderr": ""
        },
        "dotnet restore lib/project.json": {
            "code": 0,
            "stdout": "restored",
            "stderr": ""
        },
        "dotnet restore": {
            "code": 0,
            "stdout": "restored",
            "stderr": ""
        },
        "dotnet restore dummy/project.json": {
            "code": 1,
            "stdout": "not restored",
            "stderr": ""
        },
        "dotnet build": {
            "code": 0,
            "stdout": "built",
            "stderr": ""
        },
    },
    "findMatch": {
        "**/project.json": ["web/project.json", "web2/project.json", "web.tests/project.json", "lib/project.json"],
        "**/project.json;**/*.csproj" :["web/project.json", "web2/project.json", "web.tests/project.json", "lib/project.json"],
        "**/project.json;**/*.csproj;**/*.vbproj" : ["web/project.json", "web2/project.json", "web.tests/project.json", "lib/project.json"],
        "*fail*/project.json": [],
        "*customoutput/project.json": ["web3/project.json", "lib2/project.json"],
        "dummy/project.json" : ["dummy/project.json"],
        "" : []
    }
};
tmr.setAnswers(a);
tmr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));

tmr.run();