import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', '/fake/path/test.sql');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=testuser;Password=testpass;');

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
        '/fake/path/test.sql': true,
        '/usr/bin/sqlcmd': true
    },
    'which': {
        '/usr/bin/sqlcmd': '/usr/bin/sqlcmd'
    },
    'exec': {
        '/usr/bin/sqlcmd -S localhost -d testdb -U testuser -i /fake/path/test.sql': {
            'code': 0,
            'stdout': 'Commands completed successfully.'
        }
    }
};
tmr.setAnswers(a);

tmr.run();
