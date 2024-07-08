import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'bash.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('targetType', 'filepath');
tmr.setInput('filePath', 'path/to/script');
tmr.setInput('workingDirectory', '/fakecwd');

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
        'path/to/bash -c pwd': {
            "code": 0,
            "stdout": "temp/path"
        },
        'path/to/bash temp/path/fileName.sh': {
            "code": 0,
            "stdout": "my script output"
        }
    },
    'stats': {
        'path/to/script': {
            isFile() {
                return true;
            },
            mode: '777'
        }
    }
};
tmr.setAnswers(a);

// Mock fs
const fs = require('fs');
const fsClone = Object.assign({}, fs);
fsClone.writeFileSync = function(filePath, contents, options) {
    // Normalize to linux paths for logs we check
    console.log(`Writing ${contents} to ${filePath.replace(/\\/g, '/')}`);
}
tmr.registerMock('fs', fsClone);

// Mock uuidv4
tmr.registerMock('uuid/v4', function () {
    return 'fileName';
});

tmr.run();