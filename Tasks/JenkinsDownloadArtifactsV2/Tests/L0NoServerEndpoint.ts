import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const taskPath = path.join(__dirname, '..', 'jenkinsdownloadartifacts.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('jobName', 'SomeJobName');
tr.setInput('saveTo', path.join(__dirname, '..'));
tr.setInput('jenkinsBuild', 'LastSuccessfulBuild'); //BuildNumber
//tr.setInput('jenkinsBuildNumber', '42');

// tr.setInput('serverEndpoint', 'ID1');

// provide answers for task mock
const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'checkPath': {
        'gradlew': true,
        'gradlew.bat': true
    }
};
tr.setAnswers(a);

tr.run();
