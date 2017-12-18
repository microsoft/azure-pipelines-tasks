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

const PublishExeToolPath = path.join(__dirname, '../modules', 'TestResultsPublisher.exe');
const PublishExeArgs = '@' + path.join(__dirname, '..', 'tempResponseFile.txt');

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
    'stdout': 'atool output here',
    'stderr': 'atool with this stderr output'
};

tr.setAnswers(a);

// Mock toolrunner
tr.registerMock('vsts-task-lib/toolrunner', require('vsts-task-lib/mock-toolrunner'));

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