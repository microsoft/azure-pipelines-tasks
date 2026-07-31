// Succeeds when sqlcmd is not on PATH and is auto-installed from go-sqlcmd releases.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', 'test.sql');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=testpass123;');

const extractedDir = '/tmp/sqlcmd-extracted';
const executableName = process.platform === 'win32' ? 'sqlcmd.exe' : 'sqlcmd';
const sqlcmdExePath = path.join(extractedDir, executableName);

// Mock SqlcmdHelper to simulate auto-install returning a path
tmr.registerMock('./src/SqlcmdHelper', {
    default: {
        findSqlcmd: async function() {
            return sqlcmdExePath;
        }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.sql': true, [sqlcmdExePath]: true },
    which: { [sqlcmdExePath]: sqlcmdExePath },
    exec: {
        [`${sqlcmdExePath} -S localhost -d testdb -U sa -l 30 -b -i test.sql`]: { code: 0, stdout: 'Changed database context.' }
    }
};
tmr.setAnswers(a);

tmr.run();


