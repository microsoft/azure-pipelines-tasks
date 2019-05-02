import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'dotnetcore.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('command', "custom");
tmr.setInput('custom', process.env["__custom__"]);
tmr.setInput('projects', process.env["__projects__"]);
tmr.setInput('arguments', process.env["__arguments__"] ? process.env["__arguments__"] : "");

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": { "dotnet": "c:\\path\\dotnet.exe" },
    "checkPath": { "c:\\path\\dotnet.exe": true },
    "exec": {
        "c:\\path\\dotnet.exe test web/project.json": {
            "code": 0,
            "stdout": "test succeeded",
            "stderr": ""
        },
        "c:\\path\\dotnet.exe test web2/project.json": {
            "code": 0,
            "stdout": "test succeeded",
            "stderr": ""
        },
        "c:\\path\\dotnet.exe test web.tests/project.json": {
            "code": 0,
            "stdout": "test succeeded",
            "stderr": ""
        },
        "c:\\path\\dotnet.exe test lib/project.json": {
            "code": 0,
            "stdout": "test succeeded",
            "stderr": ""
        },
        "c:\\path\\dotnet.exe test fails/project.json --no-build --no-restore": {
            "code": 1,
            "stdout": "test failed",
            "stderr": ""
        },
        "c:\\path\\dotnet.exe vstest supplied/in/arguments.dll --framework netcoreapp2.0": {
            "code": 0,
            "stdout": "vstest succeeded",
            "stderr": ""
        }
    },
    "findMatch": {
        "**/project.json": ["web/project.json", "web2/project.json", "web.tests/project.json", "lib/project.json"],
        "**/project.json;**/*.csproj;**/*.vbproj": ["web/project.json", "web2/project.json", "web.tests/project.json", "lib/project.json"],
        "*nomatch*/project.json": [],
        "fails/project.json": ["fails/project.json"],
        "withArguments/project.json": ["withArguments/project.json"],
        "" : []
    }
};

tmr.setAnswers(a);
tmr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));

tmr.run();