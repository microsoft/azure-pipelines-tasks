import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'src', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.sqlproj');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;Integrated Security=true;');

// Mock answers
let a: ma.TaskLibAnswers = {
    'checkPath': {
        'test.sqlproj': true
    }
};
tmr.setAnswers(a);

tmr.run();
