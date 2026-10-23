import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const taskPath = path.join(__dirname, '..', 'main.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('source', 'current');
tr.setInput('path', 'out');
process.env['SYSTEM_SERVERTYPE'] = 'Hosted';
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = __dirname;
process.env['SYSTEM_TEAMPROJECTID'] = 'not-a-guid';
process.env['BUILD_BUILDID'] = '42';

tr.run();
