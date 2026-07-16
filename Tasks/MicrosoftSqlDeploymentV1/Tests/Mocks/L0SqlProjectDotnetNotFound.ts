import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs
tmr.setInput('action', 'publish');
tmr.setInput('path', '/fake/project/MyDatabase.sqlproj');
tmr.setInput('connectionString', 'Server=myserver.database.windows.net;Database=MyDB;User Id=admin;Password=pass123');

// Mock answers - dotnet not found
let a: ma.TaskLibAnswers = {
    'which': {
        'dotnet': ''  // Not found
    },
    'checkPath': {
        '/fake/project/MyDatabase.sqlproj': true
    },
    'exist': {
        '/fake/project/MyDatabase.sqlproj': true
    }
};
tmr.setAnswers(a);

tmr.run();
