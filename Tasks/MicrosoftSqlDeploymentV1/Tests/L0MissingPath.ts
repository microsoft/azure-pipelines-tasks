// Fails when required 'path' input is missing.
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=testpass123;');

tmr.run();


