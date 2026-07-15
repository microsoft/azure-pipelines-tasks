import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'src', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', '/path/to/nonexistent.dacpac'); // Path doesn't exist
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;Integrated Security=true;');

// Mock answers - checkPath will fail because file doesn't exist
let a: ma.TaskLibAnswers = {
    'checkPath': {
        '/path/to/nonexistent.dacpac': false  // File doesn't exist
    }
};
tmr.setAnswers(a);

tmr.run();
