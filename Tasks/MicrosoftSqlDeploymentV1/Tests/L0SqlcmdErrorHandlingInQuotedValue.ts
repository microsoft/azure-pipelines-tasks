// -b must still be applied when the text "-b" only appears inside another option's value.
//
// The opt-out used to be detected by searching the raw argument text, so a variable value such as
// Label="release -b canary" looked like an explicit -b. The task then omitted its own -b while the
// real argv contained none, and go-sqlcmd defaults exit-on-error to false, so a failing script
// exited 0 and a half-applied migration was reported as a successful deployment.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const scriptPath = 'script.sql';

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', scriptPath);
tmr.setInput('connectionString', 'Server=myserver.database.windows.net;Database=db;User ID=sa;Password=TestPass123!;');
tmr.setInput('additionalArguments', '-v Label="release -b canary"');

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

// Only the form carrying the task's own -b is answered, so suppressing it leaves the command
// unmatched instead of passing on a run that would not stop at a failing statement.
(a.exec as any)[`/usr/bin/sqlcmd -S myserver.database.windows.net -d db -U sa -l 30 -b -i ${scriptPath} -v Label=release -b canary`] = {
    code: 0,
    stdout: 'Changed database context to db.'
};

tmr.setAnswers(a);

tmr.run();
