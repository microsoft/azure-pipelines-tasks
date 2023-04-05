import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'cmaketask.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

let answers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "cmake": "/usr/local/bin/cmake"
    },
    "checkPath": {
        "/usr/local/bin/cmake": true
    }
}
tmr.setAnswers(answers);

tmr.run();
