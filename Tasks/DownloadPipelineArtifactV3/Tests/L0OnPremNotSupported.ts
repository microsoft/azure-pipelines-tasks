import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const taskPath = path.join(__dirname, '..', 'main.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('source', 'current');
tr.setInput('path', 'out');
process.env['SYSTEM_SERVERTYPE'] = 'OnPremises';
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = __dirname;

tr.run();
