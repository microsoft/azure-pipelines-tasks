// Fails when user-specified sqlcmd path does not exist.
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', 'test.sql');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');
tmr.setInput('sqlcmdPath', '/custom/path/sqlcmd.exe');

// Mock fs.existsSync to return false for user-provided sqlcmd path (path not found)
tmr.registerMock('fs', {
    existsSync: (filePath: string) => {
        if (filePath === '/custom/path/sqlcmd.exe') {
            return false; // User-provided sqlcmd path does NOT exist - should fail
        }
        if (filePath === 'test.sql') {
            return true;
        }
        return false;
    }
});

tmr.setAnswers({ checkPath: { 'test.sql': true } });

tmr.run();


