// Succeeds with minimal valid inputs for a .sqlproj build + deploy.
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.sqlproj');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');

const builtDacpac = path.join(path.dirname('test.sqlproj'), 'bin', 'Debug', 'test.dacpac');

tmr.setAnswers({
    checkPath: { 'test.sqlproj': true, '/usr/bin/dotnet': true },
    which: { 'dotnet': '/usr/bin/dotnet' },
    exec: {
        '/usr/bin/dotnet build test.sqlproj -p:NetCoreBuild=true': { code: 0, stdout: 'Build succeeded.' }
    }
});

tmr.registerMock('fs', {
    existsSync: (p: string) => {
        if (p === 'test.sqlproj') { return true; }
        if (p.includes('.dotnet')) { return true; }
        if (p === builtDacpac || p.includes('.dacpac')) { return true; }
        return false;
    },
    readdirSync: () => []
});

tmr.run();

