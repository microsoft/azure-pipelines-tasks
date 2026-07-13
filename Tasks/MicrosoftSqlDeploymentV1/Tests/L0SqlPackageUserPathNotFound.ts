import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'src', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.dacpac');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;Integrated Security=true;');
tmr.setInput('sqlpackagePath', '/nonexistent/path/sqlpackage.exe');

// Mock fs.existsSync to return false for user-provided path
tmr.registerMock('fs', {
    existsSync: (filePath: string) => {
        if (filePath === '/nonexistent/path/sqlpackage.exe') {
            return false; // User-provided path does not exist
        }
        if (filePath === 'test.dacpac') {
            return true;
        }
        return false;
    }
});

tmr.run();
