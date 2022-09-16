import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import path = require('path');

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
        'gradlew.bat buildEnvironment': {
            'code': 0,
            'stdout': '+--- com.android.application:com.android.application.gradle.plugin:7.2.2'
        },
        'gradlew buildEnvironment': {
            'code': 0,
            'stdout': '+--- com.android.application:com.android.application.gradle.plugin:7.2.2'
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

tr.run();