// Encrypt=Mandatory must reach sqlcmd, exactly as Encrypt=True does.
//
// Mandatory is the current SqlClient spelling of True. Leaving it unrecognised produced no -N
// switch at all, and sqlcmd neither encrypts nor validates the certificate without one, so an
// explicit request to encrypt was silently discarded. go-sqlcmd v1.10 accepts the value directly;
// it is normalized to true here because the two are defined as equivalent.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const scriptPath = 'script.sql';

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', scriptPath);
tmr.setInput(
    'connectionString',
    'Server=myserver.database.windows.net;Database=db;User ID=sa;Password=TestPass123!;Encrypt=Mandatory'
);

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

// Only the encrypted form is answered. Without the mapping no -N is emitted, the command line
// does not match, and the test fails rather than passing on a downgraded connection.
(a.exec as any)['/usr/bin/sqlcmd -S myserver.database.windows.net -d db -U sa -N true -l 30 -b -i script.sql'] = {
    code: 0,
    stdout: 'Changed database context to db.'
};

tmr.setAnswers(a);

tmr.run();
