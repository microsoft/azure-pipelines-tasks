import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'dotnetcore.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('command', "publish");
tmr.setInput('projects', process.env["__projects__"]);
tmr.setInput('publishWebProjects', process.env["__publishWebProjects__"] && process.env["__publishWebProjects__"] == "true" ? "true": "false");
tmr.setInput('arguments', process.env["__arguments__"] ? process.env["__arguments__"] : "");

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": { "dotnet": "dotnet"},
    "checkPath": {"dotnet": true},
    "exist": {
        "web/web.config": true,
        "web2/wwwroot": true,
    },
    "exec": {
        "dotnet publish web/project.json": {
            "code": 0,
            "stdout": "published",
            "stderr": ""
        },
        "dotnet publish web2/project.json": {
            "code": 0,
            "stdout": "published",
            "stderr": ""
        },
        "dotnet publish web.tests/project.json": {
            "code": 0,
            "stdout": "published",
            "stderr": ""
        },
        "dotnet publish lib/project.json": {
            "code": 0,
            "stdout": "published",
            "stderr": ""
        },
        "dotnet publish web3/project.json --configuration release --output /usr/out/web3": {
            "code": 0,
            "stdout": "published",
            "stderr": ""
        },
        "dotnet publish lib2/project.json --configuration release --output /usr/out/lib2": {
            "code": 0,
            "stdout": "published",
            "stderr": ""
        },
        "dotnet publish --configuration release --output /usr/out": {
            "code": 0,
            "stdout": "published",
            "stderr": ""
        },
        "dotnet publish": {
            "code": 0,
            "stdout": "published",
            "stderr": ""
        },
        "dotnet publish dummy/project.json": {
            "code": 1,
            "stdout": "not published",
            "stderr": ""
        }
    }
};

process.env["MOCK_NORMALIZE_SLASHES"] = "true";
tmr.setAnswers(a);
tmr.registerMock('vsts-task-lib/toolrunner', require('vsts-task-lib/mock-toolrunner'));
tmr.registerMock('nuget-task-common/utility', require('./mock-findfiles'));

tmr.run();