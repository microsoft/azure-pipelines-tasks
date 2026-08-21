// ServerCertificate pins the connection to a specific certificate and must reach sqlcmd as -J.
//
// The property was previously dropped with only a warning, so a caller asking for
// Encrypt=Strict;ServerCertificate=... got -N strict and no pin, and the deployment went green
// while validating against the machine trust store instead of the certificate that was named.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const scriptPath = 'script.sql';
const certificatePath = '/certs/server.cer';

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', scriptPath);
tmr.setInput(
    'connectionString',
    'Server=myserver.database.windows.net;Database=db;User ID=sa;Password=TestPass123!;' +
    `Encrypt=Strict;ServerCertificate=${certificatePath}`
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

// Only the pinned form is answered, so dropping -J leaves the command line unmatched and fails
// the test rather than passing on an unpinned connection.
(a.exec as any)[`/usr/bin/sqlcmd -S myserver.database.windows.net -d db -U sa -N strict -J ${certificatePath} -l 30 -b -i script.sql`] = {
    code: 0,
    stdout: 'Changed database context to db.'
};

tmr.setAnswers(a);

tmr.run();
