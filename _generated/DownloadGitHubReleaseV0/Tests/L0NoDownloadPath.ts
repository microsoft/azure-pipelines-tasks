import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const taskPath = path.join(__dirname, '..', 'main.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('connection', 'github connection 1');
tr.setInput('userRepository', 'userOrg/repoName');
tr.setInput('defaultVersionType', 'Latest Release');

tr.run();