import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

const taskPath = path.join(__dirname, '..', 'jenkinsqueuejobtask.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('serverEndpoint', 'ID1');
tr.setInput('jobName', 'SomeJobName');
tr.setInput('captureConsole', 'true');
tr.setInput('capturePipeline', 'true');
//tr.setInput('parameterizedJob', 'false');

// provide answers for task mock
const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'checkPath': {
        'gradlew': true,
        'gradlew.bat': true
    },
    'osType': {
        'osType': 'Windows'
    }
};
tr.setAnswers(a);

tr.run();
