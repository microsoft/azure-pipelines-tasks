import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'src', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.txt'); // Invalid extension - should fail
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;Integrated Security=true;');

tmr.run();
