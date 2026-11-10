// Spaces in the script path must keep working, unquoted.
//
// Directory and file names with spaces are ordinary, and go-sqlcmd accepts them as-is. An earlier
// attempt to quote paths defensively broke exactly this case, so it is pinned here: the path is
// passed through unchanged, with no quoting added.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const scriptPath = 'my migrations/release 2026.sql';

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', scriptPath);
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');

tmr.registerMock('./src/SqlcmdHelper', {
    default: {
        findSqlcmd: async function() { return '/usr/bin/sqlcmd'; }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: { [scriptPath]: true, '/usr/bin/sqlcmd': true },
    which: { '/usr/bin/sqlcmd': '/usr/bin/sqlcmd' },
    exec: {}
};

// Unquoted: quoting this path is what breaks it.
(a.exec as any)[`/usr/bin/sqlcmd -S localhost -d testdb -U sa -l 30 -b -i ${scriptPath}`] = {
    code: 0,
    stdout: 'Changed database context to testdb.'
};

tmr.setAnswers(a);

tmr.run();
