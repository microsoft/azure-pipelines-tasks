// The task adds -b so a failing statement fails the deployment, but a user who wants
// best-effort behaviour must be able to opt out. When additionalArguments already states
// the intent, the task must not impose its own -b.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', 'test.sql');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');
tmr.setInput('additionalArguments', '--exit-on-error=false');

tmr.registerMock('./src/SqlcmdHelper', {
    default: {
        findSqlcmd: async function() { return '/usr/bin/sqlcmd'; }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.sql': true, '/usr/bin/sqlcmd': true },
    which: { '/usr/bin/sqlcmd': '/usr/bin/sqlcmd' },
    exec: {
        // No task-injected -b; the user's own flag is passed through instead
        '/usr/bin/sqlcmd -S localhost -d testdb -U sa -l 30 -i test.sql --exit-on-error=false': {
            code: 0,
            stdout: 'Changed database context to testdb.'
        }
    }
};
tmr.setAnswers(a);

tmr.run();
