
import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'shellscript.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('scriptPath', '/script.sh');
tmr.setInput('args', 'arg1 arg2');
tmr.setInput('cwd', 'fake/wd');
tmr.setInput('failOnStandardError', 'true');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "bash": "/usr/local/bin/bash",
        "node": "/usr/local/bin/node"
    },
    "exec": {
        "/usr/local/bin/bash /script.sh arg1 arg2": {
            "code": 0,
            "stdout": "bash output here",
            "stderr": "bash error output here"
        }
    },
    "checkPath" : {
        "/usr/local/bin/bash": true,
        "/usr/local/bin/node": true,
        "/script.sh" : true
    }
};
tmr.setAnswers(a);

// if you need to, you can mock a specific module function called in task 
// tmr.registerMock('./taskmod', {
//     sayHello: function() {
//         console.log('Hello Mock!');
//     }
// });

tmr.run();

