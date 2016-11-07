import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'prcatask.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['BUILD_SOURCEBRANCH'] = 'refs/pull/6/master'; //task-lib doesn't support getVariable yet, so we need these

tmr.setInput('messageLimit', '3.14');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "getVariable": { // This doesn't work, but when it does the process.env['...'] calls can be removed
        "Build.SourceBranch": "refs/pull/6/master",
    },
};
tmr.setAnswers(a);

// if you need to, you can mock a specific module function called in task 
// tmr.registerMock('./taskmod', {
//     sayHello: function() {
//         console.log('Hello Mock!');
//     }
// });

tmr.run();

