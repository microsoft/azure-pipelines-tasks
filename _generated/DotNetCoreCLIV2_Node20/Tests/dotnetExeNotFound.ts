import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'dotnetexe.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('command', 'restore');

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": { "dotnet": "dotnet"},
    "checkPath": {"dotnet": false}
};

tmr.setAnswers(a);
tmr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));

tmr.run();