import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const taskPath = path.join(__dirname, '..', 'main.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('source', 'current');
tr.setInput('path', 'out');
process.env['SYSTEM_SERVERTYPE'] = 'Hosted';
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = __dirname;
process.env['SYSTEM_TEAMPROJECTID'] = '11111111-1111-1111-1111-111111111111';
process.env['SYSTEM_HOSTTYPE'] = 'Release';
// The agent that runs these tests sets BUILD_BUILDID too.
delete process.env['BUILD_BUILDID'];

tr.run();
