// Succeeds with AAD Password auth (-G + -U + SQLCMDPASSWORD env var).
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', 'test.sql');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;Authentication=Active Directory Password;User ID=user@tenant.com;Password=MyPassword;');

tmr.registerMock('./src/SqlcmdHelper', {
    default: {
        findSqlcmd: async function() { return '/usr/bin/sqlcmd'; }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.sql': true, '/usr/bin/sqlcmd': true },
    which: { '/usr/bin/sqlcmd': '/usr/bin/sqlcmd' },
    exec: {
            // AAD Password: --authentication-method flag + -U user, password via SQLCMDPASSWORD env var
            '/usr/bin/sqlcmd -S localhost -d testdb --authentication-method ActiveDirectoryPassword -U user@tenant.com -l 30 -b -i test.sql': {
            code: 0,
            stdout: 'Changed database context to testdb.'
        }
    }
};
tmr.setAnswers(a);

tmr.run();
