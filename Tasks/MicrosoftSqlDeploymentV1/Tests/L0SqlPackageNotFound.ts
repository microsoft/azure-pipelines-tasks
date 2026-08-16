import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', '/fake/path/test.dacpac');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=testuser;Password=testpass;');

// Mock SqlPackageHelper to throw error
tmr.registerMock('./src/SqlPackageHelper', {
    default: {
        findSqlPackage: async function() {
            throw new Error('SqlPackage not found');
        }
    }
});

let a: ma.TaskLibAnswers = {
    'checkPath': {
        '/fake/path/test.dacpac': true
    },
    'which': {
        'sqlpackage': null,
        'dotnet': null
    }
};
tmr.setAnswers(a);

tmr.run();
