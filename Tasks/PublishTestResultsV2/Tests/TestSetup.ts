import  * as ma from 'vsts-task-lib/mock-answer';
import * as tmrm from 'vsts-task-lib/mock-run';
import * as tmt from 'vsts-task-lib/mock-task';
import * as constants from './Constants';
import * as path from 'path';

// Get the task path
const taskPath = path.join(__dirname, '..', 'publishtestresults.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs
tr.setInput('testRunner', process.env[constants.testRunner]);
tr.setInput('testResultsFiles', process.env[constants.testResultsFiles]);
tr.setInput('mergeTestResults', process.env[constants.mergeTestResults]);
tr.setInput('platform', process.env[constants.platform]);
tr.setInput('configuration', process.env[constants.configuration]);
tr.setInput('testRunTitle', process.env[constants.testRunTitle]);
tr.setInput('publishRunAttachments', process.env[constants.publishRunAttachments]);
tr.setInput('searchFolder', process.env[constants.searchFolder]);
tr.setInput('failTaskOnFailedTests', process.env[constants.failTaskOnFailedTests]);

const PublishExeToolPath = path.join(__dirname, '../modules', 'TestResultsPublisher.exe');
const newUuid = "1e1faf9e-d9e5-4054-b351-398ac75b62f5";
const PublishExeArgs = '@' + path.join(__dirname, newUuid + '.txt');

// Construct the answers object
const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'which': {
    },
    'checkPath': {
    },
    'exec': {
    }
};
a.exec[`${PublishExeToolPath} ${PublishExeArgs}`] = {
    'code': +process.env[constants.listPackagesReturnCode],
    'stdout': 'tool output',
    'stderr': ''
};

tr.setAnswers(a);

// Mock toolrunner
tr.registerMock('vsts-task-lib/toolrunner', require('vsts-task-lib/mock-toolrunner'));

// Mock guid generator
tr.registerMock('uuid', {
    v1: function () {
        return newUuid;
    }
});

// Create mock for getVariable
const tl = require('vsts-task-lib/mock-task');
const tlClone = Object.assign({}, tl);

tlClone.getVariable = function (variable: string) {
    return process.env[variable];
};

tlClone.osType = function () {
    return process.env[constants.osType];
}

tlClone.findMatch = function () {
    let matchingFiles: string[] = ["n-files0.xml"];
    return matchingFiles;
}

tlClone.getEndpointAuthorizationParameter = function () {
    return 'ad4sldkajdsf4ksa5randomaccesstoken7lf9adsnfandfjlsdf';
}
tr.registerMock('vsts-task-lib/mock-task', tlClone);

// Start the run
tr.run();