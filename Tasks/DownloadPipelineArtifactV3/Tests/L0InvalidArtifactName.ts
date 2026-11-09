import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const taskPath = path.join(__dirname, '..', 'main.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('source', 'current');
tr.setInput('path', 'out');
tr.setInput('artifact', 'bad/name');
process.env['SYSTEM_SERVERTYPE'] = 'Hosted';
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = __dirname;

tr.run();
