import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'src', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', 'test.sql');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;Integrated Security=true;');
// No sqlcmdPath input - should discover from PATH

// Mock fs.existsSync to return true for test.sql
tmr.registerMock('fs', {
    existsSync: (filePath: string) => {
        if (filePath === 'test.sql') {
            return true;
        }
        return false;
    }
});

// Mock tl.which to simulate sqlcmd found on PATH
tmr.setAnswers({
    which: {
        'sqlcmd': '/usr/bin/sqlcmd'  // Simulate sqlcmd found on PATH
    },
    checkPath: {
        'test.sql': true
    }
});

tmr.run();
