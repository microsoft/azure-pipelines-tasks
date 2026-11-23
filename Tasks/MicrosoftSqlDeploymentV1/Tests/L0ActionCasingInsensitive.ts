// YAML is not constrained to the pickList casing, so 'SqlScript' must behave like 'sqlScript'
// and still trigger sqlcmd discovery.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'SqlScript');
tmr.setInput('path', 'test.sql');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');

tmr.registerMock('./src/SqlcmdHelper', {
    default: {
        findSqlcmd: async function() {
            return '/usr/bin/sqlcmd';
        }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.sql': true, '/usr/bin/sqlcmd': true },
    which: { '/usr/bin/sqlcmd': '/usr/bin/sqlcmd' },
    exec: {
        '/usr/bin/sqlcmd -S localhost -d testdb -U sa -l 30 -b -i test.sql': {
            code: 0,
            stdout: 'Changed database context to testdb.'
        }
    }
};
tmr.setAnswers(a);

tmr.run();
