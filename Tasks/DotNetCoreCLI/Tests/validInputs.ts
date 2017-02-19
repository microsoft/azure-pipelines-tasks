import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'dotnetcore.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('command', "restore");
tmr.setInput('projects', process.env["__projects__"]);

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": { "dotnet": "dotnet"},
    "checkPath": {"dotnet": true},
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
        }
    }
};
tmr.setAnswers(a);
tmr.registerMock('vsts-task-lib/toolrunner', require('vsts-task-lib/mock-toolrunner'));
tmr.registerMock('nuget-task-common/utility', require('./mock-findfiles'));

tmr.run();