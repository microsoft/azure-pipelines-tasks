import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'dotnetcore.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set the feature flag to disable the publish logger
process.env["DISTRIBUTEDTASK_TASKS_DISABLEDOTNETPUBLISHLOGGER"] = "true";

tmr.setInput('command', "publish");
tmr.setInput('projects', "web/project.csproj");
tmr.setInput('publishWebProjects', "false");
tmr.setInput('arguments', "");

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": { "dotnet": "dotnet" },
    "checkPath": { "dotnet": true },
    "exec": {},
    "findMatch": {
        "web/project.csproj": ["web/project.csproj"]
    }
};

// When feature flag is enabled (disables logger), expect publish WITHOUT logger argument
a["exec"]["dotnet publish web/project.csproj"] = {
    "code": 0,
    "stdout": "published without logger",
    "stderr": ""
};

tmr.setAnswers(a);
tmr.run();
