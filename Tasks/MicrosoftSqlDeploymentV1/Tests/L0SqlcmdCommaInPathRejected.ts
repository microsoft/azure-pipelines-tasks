// A comma in the script path is refused with an explanation.
//
// go-sqlcmd's -i takes a comma-separated list of files, so a comma inside a path is read as a
// separator and sqlcmd looks for files that do not exist. The task deploys a single file, so a
// comma is always part of a name, but there is no way to say that unambiguously on the command
// line: triple quoting works only when the path has no spaces, and breaks the paths that do.
//
// Failing with a clear message beats letting sqlcmd silently read the wrong files.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const scriptPath = 'migrations/2026,08.sql';

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
    // No sqlcmd entry: running it at all would mean reading the wrong files.
    exec: {}
};
tmr.setAnswers(a);

tmr.run();
