import * as path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'usenode.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('version', '26.x');
tmr.setInput('versionFilePath', '.node-version');

tmr.run();
