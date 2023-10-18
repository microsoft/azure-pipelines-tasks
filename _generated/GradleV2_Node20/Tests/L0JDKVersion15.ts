import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import path = require('path');

let taskPath = path.join(__dirname, '..', 'gradletask.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('wrapperScript', 'gradlew');
tr.setInput('cwd', '/home/repo/src');
tr.setInput('options', '');
tr.setInput('tasks', 'build');
tr.setInput('javaHomeSelection', 'JDKVersion');
tr.setInput('publishJUnitResults', 'true');
tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
tr.setInput('jdkVersion', '1.5');
tr.setInput('jdkArchitecture', 'x86');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'checkPath': {
        'gradlew': true,
        'gradlew.bat': true,
        '/home/repo/src': true
    },
    'exec': {
        'gradlew build': {
            'code': 0,
            'stdout': 'Sample gradle output'
        },
        'gradlew.bat build': {
            'code': 0,
            'stdout': 'Sample gradle output'
        },
        'reg query HKLM\\SOFTWARE\\JavaSoft\\Java Development Kit\\ /f 1.5 /k': {
            'code': 222,
            'stdout': ''
        },
        'reg query HKLM\\SOFTWARE\\JavaSoft\\Java Development Kit\\1.5 /v JavaHome /reg:32': {
            'code': 222,
            'stdout': ''
        }
    }
};
tr.setAnswers(a);

tr.run();
