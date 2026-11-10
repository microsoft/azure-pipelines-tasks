// Options written on separate lines must arrive as separate arguments.
//
// A YAML block scalar is the documented way to pass several options, but the tokenizer split on
// literal spaces only, so every line after the first was glued onto the previous argument and
// sqlcmd received one malformed option instead of two.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const scriptPath = 'script.sql';

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', scriptPath);
tmr.setInput('connectionString', 'Server=myserver.database.windows.net;Database=db;User ID=sa;Password=TestPass123!;');
// Tab and newline, the two separators a block scalar actually produces.
tmr.setInput('additionalArguments', '-v First=1\n-v\tSecond="two words"');

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

// Quoted whitespace still holds a value together, so only the unquoted separators split.
(a.exec as any)[`/usr/bin/sqlcmd -S myserver.database.windows.net -d db -U sa -l 30 -b -i ${scriptPath} -v First=1 -v Second=two words`] = {
    code: 0,
    stdout: 'Changed database context to db.'
};

tmr.setAnswers(a);

tmr.run();
