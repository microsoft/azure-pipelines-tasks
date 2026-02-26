import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'postbash.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('workingDirectory', '/fakecwd');
// No postJobScript provided - should skip execution

// Create assertAgent and getVariable mocks
const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.getVariable = function(variable: string) {
    if (variable.toLowerCase() == 'agent.tempdirectory') {
        return 'temp/path';
    }
    return null;
};
tlClone.assertAgent = function(variable: string) {
    return;
};
tmr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

// Mock task-lib
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'checkPath' : {
        '/fakecwd' : true,
        'path/to/bash': true,
        'temp/path': true
    },
    'which': {
        'bash': 'path/to/bash'
    },
    'assertAgent': {
        '2.115.0': true
    }
};
tmr.setAnswers(a);

tmr.run();
