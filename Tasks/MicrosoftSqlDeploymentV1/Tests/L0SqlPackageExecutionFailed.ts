// Fails when SqlPackage exits with non-zero code.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.dacpac');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');

tmr.registerMock('./src/SqlPackageHelper', {
    default: {
        findSqlPackage: async function() {
            return '/usr/local/bin/sqlpackage';
        }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: {
        'test.dacpac': true,
        '/usr/local/bin/sqlpackage': true
    },
    which: {
        '/usr/local/bin/sqlpackage': '/usr/local/bin/sqlpackage'
    },
    exec: {
        '/usr/local/bin/sqlpackage /Action:Publish /SourceFile:test.dacpac /TargetConnectionString:Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;': {
            code: 1,
            stdout: '',
            stderr: 'Error: deployment failed'
        }
    }
};
tmr.setAnswers(a);

tmr.run();
