import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', '..', 'src', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs
tmr.setInput('action', 'publish');
tmr.setInput('path', '/fake/project/MyDatabase.sqlproj');
tmr.setInput('connectionString', 'Server=myserver.database.windows.net;Database=MyDB;User Id=admin;Password=pass123');

// Mock answers
let a: ma.TaskLibAnswers = {
    'which': {
        'dotnet': '/usr/bin/dotnet'
    },
    'checkPath': {
        '/fake/project/MyDatabase.sqlproj': true,
        '/usr/bin/dotnet': true
    },
    'exist': {
        '/fake/project/MyDatabase.sqlproj': true
    },
    'exec': {
        'dotnet build /fake/project/MyDatabase.sqlproj -p:NetCoreBuild=true': {
            'code': 1,
            'stdout': '',
            'stderr': 'error MSB1009: Project file does not exist.'
        }
    }
};
tmr.setAnswers(a);

tmr.run();
