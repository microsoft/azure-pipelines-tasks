// Succeeds when sqlcmd is found at user-specified path.
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', 'test.sql');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;Integrated Security=true;');
tmr.setInput('sqlcmdPath', '/custom/path/sqlcmd.exe');

// Mock fs.existsSync to return true for user-provided sqlcmd path
tmr.registerMock('fs', {
    existsSync: (filePath: string) => {
        if (filePath === '/custom/path/sqlcmd.exe') {
            return true; // User-provided path exists - should succeed
        }
        if (filePath === 'test.sql') {
            return true;
        }
        return false;
    }
});

tmr.run();
