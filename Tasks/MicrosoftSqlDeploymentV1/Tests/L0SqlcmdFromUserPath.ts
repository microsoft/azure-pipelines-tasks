// Succeeds when sqlcmd is found at user-specified path.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', 'test.sql');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');
tmr.setInput('sqlcmdPath', '/custom/path/sqlcmd');

tmr.registerMock('./src/SqlcmdHelper', {
    default: {
        findSqlcmd: async function() {
            return '/custom/path/sqlcmd';
        }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.sql': true, '/custom/path/sqlcmd': true },
    which: { '/custom/path/sqlcmd': '/custom/path/sqlcmd' },
    exec: {
        '/custom/path/sqlcmd -S localhost -d testdb -U sa -l 30 -i test.sql': { code: 0, stdout: 'Changed database context.' }
    }
};
tmr.setAnswers(a);

tmr.run();


