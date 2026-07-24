import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs
tmr.setInput('action', 'publish');
tmr.setInput('path', '/fake/project/MyDatabase.sqlproj');
tmr.setInput('connectionString', 'Server=myserver.database.windows.net;Database=MyDB;User Id=admin;Password=pass123');

// Mock SqlPackageHelper so discovery succeeds and the test deterministically
// reaches the DotnetNotFound check rather than failing early at SqlPackageNotFound.
tmr.registerMock('./src/SqlPackageHelper', {
    default: {
        findSqlPackage: async function() {
            return '/usr/local/bin/sqlpackage';
        }
    }
});

// Mock answers - dotnet not found
let a: ma.TaskLibAnswers = {
    'which': {
        'dotnet': ''  // Not found — triggers DotnetNotFound error
    },
    'checkPath': {
        '/fake/project/MyDatabase.sqlproj': true
    }
};
tmr.setAnswers(a);

tmr.run();


