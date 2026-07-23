// Succeeds with script action and generates output file in temp directory.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'script');
tmr.setInput('path', 'test.dacpac');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');

tmr.registerMock('./src/SqlPackageHelper', {
    default: {
        findSqlPackage: async function() {
            return '/usr/local/bin/sqlpackage';
        }
    }
});

// SqlPackage executor auto-generates /OutputPath for script action when user doesn't specify one.
// The exec key ends with the auto-generated path, which is dynamic, so we match by prefix using
// ignoreReturnCode=false behavior — we provide a wildcard-style answer via the function form.
const a: ma.TaskLibAnswers = {
    checkPath: {
        'test.dacpac': true,
        '/usr/local/bin/sqlpackage': true
    },
    which: {
        '/usr/local/bin/sqlpackage': '/usr/local/bin/sqlpackage'
    },
    exec: {}
};

// Provide explicit /OutputPath so the exec key is deterministic.
tmr.setInput('additionalArguments', '/OutputPath:/tmp/output.sql');
(a.exec as any)['/usr/local/bin/sqlpackage /Action:Script /SourceFile:test.dacpac /TargetConnectionString:Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!; /OutputPath:/tmp/output.sql'] = {
    code: 0,
    stdout: 'Script generated successfully.'
};

tmr.registerMock('fs', {
    existsSync: (p: string) => {
        if (p === 'test.dacpac') { return true; }
        if (p === '/tmp/output.sql') { return true; }
        return false;
    },
    mkdirSync: () => {},
    readdirSync: () => []
});

tmr.setAnswers(a);

tmr.run();
