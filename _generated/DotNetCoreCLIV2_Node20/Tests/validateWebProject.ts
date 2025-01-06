import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'dotnetcore.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('command', "publish");
tmr.setInput('projects', process.env["__projects__"]);
tmr.setInput('publishWebProjects', process.env["__publishWebProjects__"] && process.env["__publishWebProjects__"] == "true" ? "true" : "false");
tmr.setInput('arguments', process.env["__arguments__"] ? process.env["__arguments__"] : "");
tmr.setInput('modifyOutputPath', process.env["modifyOutput"] == "false" ? "false" : "true");
tmr.setInput('zipAfterPublish', process.env["zipAfterPublish"] ? process.env["zipAfterPublish"] : "false");
tmr.setInput('workingDirectory', process.env["workingDirectory"] ? process.env["workingDirectory"] : "");

process.env['TASK_TEST_TRACE'] = "true";

var projectFile = path.join(__dirname, process.env["__projects__"]);
var execCommand = "dotnet publish " + projectFile

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "dotnet": "dotnet",
    },
    "checkPath": { "dotnet": true },
    "exec": {},
    "findMatch": {
        "**/*.csproj\n**/*.vbproj\n**/*.fsproj": [projectFile]
    }
}

a['exec'][execCommand] =  {
    "code": 0,
    "stdout": "published",
    "stderr": ""
}

process.env["MOCK_NORMALIZE_SLASHES"] = "true";
tmr.setAnswers(a)
tmr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));

tmr.run();