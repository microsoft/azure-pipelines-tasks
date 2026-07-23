// Succeeds with minimal valid inputs for a .dacpac deployment.
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.dacpac');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');

tmr.setAnswers({ checkPath: { 'test.dacpac': true } });

tmr.registerMock('fs', {
    existsSync: (p: string) => p === 'test.dacpac' || p.includes('.dotnet'),
    readdirSync: () => []
});

tmr.run();

