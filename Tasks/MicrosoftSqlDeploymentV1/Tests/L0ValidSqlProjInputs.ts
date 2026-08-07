import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', '/fake/path/test.sqlproj');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=testuser;Password=testpass;');

// Mock SqlPackageHelper
tmr.registerMock('./src/SqlPackageHelper', {
    default: {
        findSqlPackage: async function() {
            return '/usr/local/bin/sqlpackage';
        }
    }
});

// Mock SqlProjectBuilder
tmr.registerMock('./src/SqlProjectBuilder', {
    default: {
        buildProject: async function() {
            return '/fake/path/bin/Debug/test.dacpac';
        }
    }
});

let a: ma.TaskLibAnswers = {
    'checkPath': {
        '/fake/path/test.sqlproj': true,
        '/usr/local/bin/sqlpackage': true
    },
    'which': {
        '/usr/local/bin/sqlpackage': '/usr/local/bin/sqlpackage'
    },
    'exec': {
        '/usr/local/bin/sqlpackage /Action:Publish /SourceFile:/fake/path/bin/Debug/test.dacpac /TargetConnectionString:Server=localhost;Database=testdb;User ID=testuser;Password=testpass;': {
            'code': 0,
            'stdout': 'Successfully published database.'
        }
    },
    'exist': {
        '/fake/path/bin/Debug/test.dacpac': true
    }
};
tmr.setAnswers(a);

tmr.run();
