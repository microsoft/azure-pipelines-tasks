import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const taskPath = path.join(__dirname, '..', 'preandroidsigning.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('apksign', 'true');
tr.setInput('keystoreFile', 'mySecureFileId');

process.env['AGENT_VERSION'] = '2.116.0';

const secureFileHelperMock = require('azure-pipelines-tasks-securefiles-common/securefiles-common-mock');
tr.registerMock('azure-pipelines-tasks-securefiles-common/securefiles-common', secureFileHelperMock);

// provide answers for task mock
const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
};
tr.setAnswers(a);

tr.run();