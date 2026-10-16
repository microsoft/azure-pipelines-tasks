import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const taskPath = path.join(__dirname, '..', 'main.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('source', 'specific');
tr.setInput('project', '11111111-1111-1111-1111-111111111111');
tr.setInput('pipeline', '1');
tr.setInput('runVersion', 'specific');
tr.setInput('runId', 'abc');
tr.setInput('path', 'out');
process.env['SYSTEM_SERVERTYPE'] = 'Hosted';
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = __dirname;
process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = 'https://example.invalid/';
process.env['ENDPOINT_AUTH_PARAMETER_SYSTEMVSSCONNECTION_ACCESSTOKEN'] = 'test-token';

tr.run();
