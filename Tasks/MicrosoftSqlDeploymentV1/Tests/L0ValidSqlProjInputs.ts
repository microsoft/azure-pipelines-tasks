// Succeeds with minimal valid inputs for a .sqlproj build + deploy.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.sqlproj');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');

tmr.registerMock('./src/SqlPackageHelper', {
    default: {
        findSqlPackage: async function() {
            return '/usr/local/bin/sqlpackage';
        }
    }
});

tmr.registerMock('./src/SqlProjectBuilder', {
    default: {
        buildProject: async function() {
            return '/fake/path/bin/Debug/test.dacpac';
        }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: {
        'test.sqlproj': true,
        '/usr/local/bin/sqlpackage': true
    },
    which: {
        '/usr/local/bin/sqlpackage': '/usr/local/bin/sqlpackage'
    },
    exec: {
        '/usr/local/bin/sqlpackage /Action:Publish /SourceFile:/fake/path/bin/Debug/test.dacpac /TargetConnectionString:Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;': {
            code: 0,
            stdout: 'Successfully published database.'
        }
    }
};
tmr.setAnswers(a);

tmr.run();

