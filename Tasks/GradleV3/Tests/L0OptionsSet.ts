import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import path = require('path');

let taskPath = path.join(__dirname, '..', 'gradletask.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('wrapperScript', 'gradlew');
tr.setInput('cwd', '/home/repo/src');
tr.setInput('options', '/o "/p t i" /o /n /s');
tr.setInput('tasks', 'build');
tr.setInput('javaHomeSelection', 'JDKVersion');
tr.setInput('jdkVersion', 'default');
tr.setInput('publishJUnitResults', 'true');
tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'checkPath': {
        'gradlew': true,
        'gradlew.bat': true,
        '/home/repo/src': true
    },
    'exec': {
        'gradlew /o /p t i /o /n /s build': {
            'code': 0,
            'stdout': 'More sample gradle output'
        },
        'gradlew.bat /o /p t i /o /n /s build': {
            'code': 0,
            'stdout': 'More sample gradle output'
        }
    }
};
tr.setAnswers(a);

tr.run();
