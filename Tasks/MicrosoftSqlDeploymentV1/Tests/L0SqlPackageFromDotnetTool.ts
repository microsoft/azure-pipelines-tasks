// Succeeds when SqlPackage is found via dotnet global tool install.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.dacpac');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');

// Mock SqlPackageHelper to return the dotnet tool path without relying on
// HOME/USERPROFILE env vars (which are dynamic per machine).
tmr.registerMock('./src/SqlPackageHelper', {
    default: {
        findSqlPackage: async function() {
            return '/home/runner/.dotnet/tools/sqlpackage';
        }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: {
        'test.dacpac': true,
        '/home/runner/.dotnet/tools/sqlpackage': true
    },
    which: {
        '/home/runner/.dotnet/tools/sqlpackage': '/home/runner/.dotnet/tools/sqlpackage'
    },
    exec: {
        '/home/runner/.dotnet/tools/sqlpackage /Action:Publish /SourceFile:test.dacpac /TargetConnectionString:Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;': {
            code: 0,
            stdout: 'Successfully published database.'
        }
    }
};
tmr.setAnswers(a);

tmr.run();


