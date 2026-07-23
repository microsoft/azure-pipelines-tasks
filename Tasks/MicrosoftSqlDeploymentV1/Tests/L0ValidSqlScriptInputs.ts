// Succeeds with minimal valid inputs for a .sql script execution.
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', 'test.sql');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');

tmr.setAnswers({
    checkPath: { 'test.sql': true },
    which: { 'sqlcmd': '/usr/bin/sqlcmd' }
});

tmr.registerMock('fs', {
    existsSync: (p: string) => p === 'test.sql',
    readdirSync: () => []
});

tmr.run();

