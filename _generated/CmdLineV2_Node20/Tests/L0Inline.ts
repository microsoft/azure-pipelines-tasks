import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'cmdline.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('targetType', 'inline');
tmr.setInput('workingDirectory', '/fakecwd');
tmr.setInput('script', `echo 'Hello world'\necho 'Goodbye world'`);

//Create assertAgent and getVariable mocks, support not added in this version of task-lib
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
tmr.setInput('script2', `echo 'Hello world'\necho 'Goodbye world'`);

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
    },
    'exec': {
        'path/to/bash --noprofile --norc temp\\path\\fileName.sh': {
            "code": 0,
            "stdout": "my script output"
        },
        'path/to/bash --noprofile --norc temp/path/fileName.sh': {
            "code": 0,
            "stdout": "my script output"
        }
    }
};
tmr.setAnswers(a);

// Mock fs
const fs = require('fs');
const fsClone = Object.assign({}, fs);
fsClone.writeFileSync = function(filePath, contents, options) {
    console.log(`Writing ${contents} to ${filePath}`);
}
tmr.registerMock('fs', fsClone);

// Mock uuidv4
tmr.registerMock('uuid', {v4: function () {
    return 'fileName';
}});

tmr.run();