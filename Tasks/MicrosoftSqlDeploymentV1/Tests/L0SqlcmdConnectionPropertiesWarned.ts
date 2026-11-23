// Properties with no sqlcmd equivalent must be reported, not dropped in silence.
//
// Pooling and Application Name do not change the outcome of a one-shot script run, so the task
// warns rather than failing. The warning names them so the user is not left believing a property
// took effect. Encrypt=Strict, TrustServerCertificate=True and HostNameInCertificate do have
// switches and must not appear in that warning.
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
    'Encrypt=Strict;TrustServerCertificate=True;HostNameInCertificate=myserver.contoso.com;' +
    'Pooling=false;Application Name=myapp'
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

(a.exec as any)['/usr/bin/sqlcmd -S myserver.database.windows.net -d db -U sa -N strict -C -F myserver.contoso.com -l 30 -b -i script.sql'] = {
    code: 0,
    stdout: 'Changed database context to db.'
};

tmr.setAnswers(a);

tmr.run();
