import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import path = require('path');

import * as fs from 'fs';

let taskPath = path.join(__dirname, '..', 'gradletask.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('wrapperScript', 'gradlew');
tr.setInput('cwd', '/home/repo/src');
tr.setInput('javaHomeSelection', 'JDKVersion');
tr.setInput('jdkVersion', 'default');
tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
tr.setInput('codeCoverageTool', 'jacoco');
tr.setInput('failIfCoverageEmpty', 'false');
tr.setInput('gradle5xOrHigher', 'false');

tr.setInput('tasks', 'build');

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'checkPath': {
        'gradlew': true,
        'gradlew.bat': true,
        '/home/repo/src': true
    },
    'exec': {
        'gradlew.bat properties': {
            'code': 0,
            'stdout': 'More sample gradle output'
        },
        'gradlew properties': {
            'code': 0,
            'stdout': 'More sample gradle output'
        },
        'gradlew.bat clean build jacocoTestReport': {
            'code': 0,
            'stdout': 'More sample gradle output'
        },
        'gradlew clean build jacocoTestReport': {
            'code': 0,
            'stdout': 'More sample gradle output'
        }
    },
    'rmRF': {
        [path.join('/home/repo/src', 'CCReport43F6D5EF')]: {
            success: true
        }
    },
    'stats': {
        [path.join('/home/repo/src', 'build.gradle')]: {
            isFile() {
                return true;
            }
        }
    },
    'exist': {
        [path.join('/home/repo/src', 'CCReport43F6D5EF/summary.xml')]: true
    }
};
tr.setAnswers(a);

const fsClone = Object.assign({}, fs);
Object.assign(fsClone, {
    // If gradle version is 5.x or higher, codecoverage-common package should try to insert assignment in this form:
    // classDirectories.setFrom files()
    // Copare this to how assignments look in gradle 4.x or lower:
    // classDirectories = files()
    // Since we're checking for gradle 4.x and lower here, we'll look for the latter one
    appendFileSync(filePath: string, data: string) {
        if (path.join('/home/repo/src', 'build.gradle') === filePath) {
            if (data.includes('classDirectories = file')) {
                console.log('Code coverage package is appending correct data (gradle 4.x and lower)');
            } else {
                throw new Error(`Code coverage package tried to append incorrect data: ${data}`);
            }
        }
    }
});
tr.registerMock('fs', fsClone);

tr.run();
