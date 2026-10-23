// Succeeds when SqlPackage is found at user-specified path.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.dacpac');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');
tmr.setInput('sqlpackagePath', '/custom/sqlpackage');

tmr.registerMock('./src/SqlPackageHelper', {
    default: {
        findSqlPackage: async function() {
            return '/custom/sqlpackage';
        }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: {
        'test.dacpac': true,
        '/custom/sqlpackage': true
    },
    which: {
        '/custom/sqlpackage': '/custom/sqlpackage'
    },
    exec: {
        '/custom/sqlpackage /Action:Publish /SourceFile:test.dacpac /TargetConnectionString:Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;': {
            code: 0,
            stdout: 'Successfully published database.'
        }
    }
};
tmr.setAnswers(a);

tmr.run();


