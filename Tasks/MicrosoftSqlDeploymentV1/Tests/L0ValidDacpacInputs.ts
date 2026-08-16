import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', '/fake/path/test.dacpac');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=testuser;Password=testpass;');
// Mock SqlPackageHelper
tmr.registerMock('./src/SqlPackageHelper', {
    default: {
        findSqlPackage: async function() {
            return '/usr/local/bin/sqlpackage';
        }
    }
});

// Mock SqlcmdHelper
tmr.registerMock('./src/SqlcmdHelper', {
    default: {
        findSqlcmd: async function() {
            return '/usr/bin/sqlcmd';
        }
    }
});
let a: ma.TaskLibAnswers = {
    'checkPath': {
        '/fake/path/test.dacpac': true,
        '/usr/local/bin/sqlpackage': true
    },
    'which': {
        '/usr/local/bin/sqlpackage': '/usr/local/bin/sqlpackage'
    },
    'exec': {
        '/usr/local/bin/sqlpackage /Action:Publish /SourceFile:/fake/path/test.dacpac /TargetConnectionString:Server=localhost;Database=testdb;User ID=testuser;Password=testpass;': {
            'code': 0,
            'stdout': 'Successfully published database.'
        }
    }
};
tmr.setAnswers(a);

tmr.run();
