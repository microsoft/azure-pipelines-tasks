import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'cmaketask.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('cmakeArgs', '..');
tmr.setInput('cwd', 'fake/wd');

let answers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "cmake": "/usr/local/bin/cmake",
        "node": "/usr/local/bin/node"
    },
    "checkPath": {
        "/usr/local/bin/cmake": true,
        "/usr/local/bin/node": true
    },
    "exec": {
        "/usr/local/bin/cmake ..": {
            "code": 50,
            "stdout": "cmake output here",
            "stderr": "cmake failed with this output"
        }
    }
}
tmr.setAnswers(answers);

tmr.run();
