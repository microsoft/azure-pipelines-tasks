import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');

let taskPath = path.join(__dirname, '..', 'preinstallprovprofile.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('provisioningProfileLocation', 'secureFiles');
tr.setInput('provProfileSecureFile', 'mySecureFileId');

process.env['AGENT_VERSION'] = '2.116.0';
process.env['HOME'] = '/users/test';

let secureFileHelperMock = require('azure-pipelines-tasks-securefiles-common/securefiles-common-mock');
tr.registerMock('azure-pipelines-tasks-securefiles-common/securefiles-common', secureFileHelperMock);

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
};
tr.setAnswers(a);

os.platform = () => {
    return 'win32';
}
tr.registerMock('os', os);

tr.run();

