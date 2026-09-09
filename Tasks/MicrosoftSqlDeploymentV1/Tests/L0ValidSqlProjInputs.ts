// Succeeds with minimal valid inputs for a .sqlproj build + deploy.
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.sqlproj');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;Integrated Security=true;');

tmr.run();
