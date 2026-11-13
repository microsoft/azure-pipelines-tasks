import  * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as tmt from 'azure-pipelines-task-lib/mock-task';
import * as constants from './Constants';
import * as path from 'path';

process.env['AGENT_VERSION'] = '5.281.1';
process.env['Build.Buildid'] = '12345';
process.env['System.PlanId'] = 'test-plan';
process.env['System.JobId'] = 'test-job';
process.env['System.TaskInstanceId'] = 'test-task';
process.env['System.JobAttempt'] = '1';
process.env['Agent.Version'] = '5.281.1';

if (process.env['PTR_TEST_FAILURE'] === 'telemetry') {
    const log = console.log;
    console.log = function (message, ...args) {
        if (typeof message === 'string' && message.indexOf('##vso[telemetry.publish ') === 0) {
            throw new Error('Simulated telemetry failure');
        }
        log.apply(console, [message, ...args]);
    };
}

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
tr.setInput('failTaskOnFailureToPublishResults', process.env[constants.failTaskOnFailureToPublishResults]);

const PublishExeToolPath = path.join(__dirname, '../modules', 'TestResultsPublisher.exe');
const newUuid = "1e1faf9e-d9e5-4054-b351-398ac75b62f5";
const PublishExeArgs = ['@' + path.join(__dirname, newUuid + '.txt')];

// Construct the answers object
const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'which': {
    },
    'checkPath': {
    },
    'exec': {
    }
};

a.exec[`${PublishExeToolPath} ${PublishExeArgs[0]}`] = {
    'code': +process.env[constants.listPackagesReturnCode],
    'stdout': 'tool output',
    'stderr': ''
};

tr.setAnswers(a);

// Mock toolrunner
tr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));

// Mock guid generator
tr.registerMock('uuid', {
    v1: function () {
        return newUuid;
    }
});

// Create mock for getVariable
const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);

tlClone.getVariable = function (variable: string) {
    return process.env[variable];
};

tlClone.osType = function () {
    return process.env[constants.osType];
}

tlClone.findMatch = function () {
    if (process.env['PTR_TEST_FAILURE'] === 'find') {
        throw new Error('Simulated file discovery failure containing mock-secret');
    }
    let matchingFiles: string[] = ["n-files0.xml"];
    return matchingFiles;
}

tlClone.getEndpointAuthorizationParameter = function () {
    return 'ad4sldkajdsf4ksa5randomaccesstoken7lf9adsnfandfjlsdf';
}

if (process.env['PTR_TEST_FAILURE'] === 'publisher') {
    const tool = tlClone.tool;
    tlClone.tool = function (file) {
        const runner = tool(file);
        runner.exec = function () {
            return Promise.reject(new Error('Simulated publisher launch failure containing mock-secret'));
        };
        return runner;
    };
}
tr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

// Start the run
tr.run();