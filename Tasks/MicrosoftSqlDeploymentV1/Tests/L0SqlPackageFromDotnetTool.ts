import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.dacpac');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;Integrated Security=true;');

// Mock answers
let a: ma.TaskLibAnswers = {
    'checkPath': {
        'test.dacpac': true
    }
};
tmr.setAnswers(a);

// Mock fs.existsSync to return true for dotnet tool location
tmr.registerMock('fs', {
    existsSync: (filePath: string) => {
        // Check for Windows dotnet tool path
        if (filePath.includes('.dotnet\\tools\\sqlpackage.exe')) {
            return true;
        }
        // Check for Linux dotnet tool path
        if (filePath.includes('.dotnet/tools/sqlpackage') && !filePath.endsWith('.exe')) {
            return true;
        }
        if (filePath === 'test.dacpac') {
            return true;
        }
        return false;
    }
});

tmr.run();

