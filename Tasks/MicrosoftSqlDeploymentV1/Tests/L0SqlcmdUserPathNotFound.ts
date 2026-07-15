import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'src', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', 'test.sql');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;Integrated Security=true;');
tmr.setInput('sqlcmdPath', '/custom/path/sqlcmd.exe');

// Mock answers
let a: ma.TaskLibAnswers = {
    'checkPath': {
        'test.sql': true
    }
};
tmr.setAnswers(a);

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

tmr.run();
