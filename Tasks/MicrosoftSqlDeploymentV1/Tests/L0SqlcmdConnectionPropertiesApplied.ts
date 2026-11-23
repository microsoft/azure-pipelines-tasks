// Connection string properties that have a sqlcmd switch must reach the tool.
//
// sqlcmd does not read a connection string, so anything the task fails to translate into a switch
// is lost. That matters most for encryption: without -N sqlcmd does not encrypt and does not
// validate the certificate, so dropping Encrypt=True downgrades a connection the user explicitly
// asked to secure. This pins the translation for the properties reported against the task.
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
    'Server=myserver.database.windows.net;Database=db;User ID=sa;Password=TestPass123!;' +
    'Encrypt=True;TrustServerCertificate=False;Connect Timeout=99;ApplicationIntent=ReadOnly'
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

// Encrypt=True becomes -N true, ApplicationIntent=ReadOnly becomes -K ReadOnly, and Connect
// Timeout=99 replaces the default -l 30. TrustServerCertificate=False adds nothing, because
// certificate validation is what sqlcmd does when -C is absent.
(a.exec as any)['/usr/bin/sqlcmd -S myserver.database.windows.net -d db -U sa -N true -K ReadOnly -l 99 -b -i script.sql'] = {
    code: 0,
    stdout: 'Changed database context to db.'
};

tmr.setAnswers(a);

tmr.run();
