import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', '/path/to/directory/'); // Path is a directory, not a file
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;Integrated Security=true;');

// Mock answers - checkPath will fail because it's a directory
let a: ma.TaskLibAnswers = {
    'checkPath': {
        '/path/to/directory/': false  // Directory, not a file
    }
};
tmr.setAnswers(a);

tmr.run();
