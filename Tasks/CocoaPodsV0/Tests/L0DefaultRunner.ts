import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import path = require('path');

let taskPath = path.join(__dirname, '..', 'cocoapods.js');



let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
tr.setInput('cwd', '/home/repo/src');
tr.setInput('forceRepoUpdate', 'true');

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers> {
    'checkPath': {
        'pod': true,
        '/home/repo/src': true,
    },
    'which': {
        'pod': 'pod'
    },
    'filePathSupplied': {
        'projectDirectory': false,
    },
    'exec': {
        'pod --version': {
            'code': 0,
            'stdout': '1.0.0'
        },
        'pod install': {
            'code': 0,
            'stdout': 'install packages'
        }
    },
}
tr.setAnswers(a);
tr.run();

