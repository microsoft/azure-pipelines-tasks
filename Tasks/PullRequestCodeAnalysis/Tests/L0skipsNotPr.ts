import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'prcatask.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['BUILD_SOURCEBRANCH'] = 'refs/heads/master'; //replace with mock of setVariable when task-lib has the support

tmr.setInput('messageLimit', '100');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "getVariable": { // This doesn't work, but when it does the process.env['...'] calls can be removed
        "build.sourceBranch": "refs/heads/master"
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

