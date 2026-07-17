import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.dacpac');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;Integrated Security=true;');

// Mock fs.existsSync to return false for all SqlPackage locations
const fsClone = Object.assign({}, fs);
fsClone.existsSync = function(filePath: any): boolean {
    // Simulate SqlPackage not found anywhere
    if (filePath && filePath.toString().includes('sqlpackage')) {
        return false;
    }
    // Return true for the input file itself
    if (filePath === 'test.dacpac') {
        return true;
    }
    return false;
};
tmr.registerMock('fs', fsClone);

// Use setAnswers to mock tl.which() returning empty
tmr.setAnswers({
    'which': {
        'sqlpackage': ''  // SqlPackage not found in PATH
    }
});

tmr.run();
