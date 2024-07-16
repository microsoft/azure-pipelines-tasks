import { TaskLibAnswers } from 'azure-pipelines-task-lib/mock-answer';
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as path from 'path';

const taskPath: string = path.join(__dirname, '..', 'bash.js');
const taskRunner: TaskMockRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('targetType', 'filepath');
taskRunner.setInput('filePath', 'path/to/script');
taskRunner.setInput('arguments', 'myCustomArg');
taskRunner.setInput('workingDirectory', '/fakecwd');
taskRunner.setInput('bashEnvValue', '~/.profile');

//Create assertAgent and getVariable mocks, support not added in this version of task-lib
const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.getVariable = function (variable: string) {
    if (variable.toLowerCase() == 'agent.tempdirectory') {
        return 'temp/path';
    }
    return null;
};
tlClone.assertAgent = function (variable: string) {
    return;
};
taskRunner.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

// Mock task-lib
const mockedAnswers: TaskLibAnswers = <TaskLibAnswers>{
    'checkPath': {
        '/fakecwd': true,
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
taskRunner.setAnswers(mockedAnswers);

// Mock fs
const fs = require('fs');
const fsClone = Object.assign({}, fs);
fsClone.writeFileSync = function (filePath, contents, options) {
    // Normalize to linux paths for logs we check
    console.log(`Writing ${contents} to ${filePath.replace(/\\/g, '/')}`);
}
taskRunner.registerMock('fs', fsClone);

// Mock uuidv4
taskRunner.registerMock('uuid/v4', function () {
    return 'fileName';
});

taskRunner.run();
