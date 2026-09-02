// /op is SqlPackage's documented short form for /OutputPath, so supplying it counts as the user
// specifying an output path.
//
// The task only looked for /OutputPath, so a user passing /op: appeared to have specified
// nothing and the task appended a second, auto-generated /OutputPath alongside it.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const outputFile = '/tmp/custom.sql';

tmr.setInput('action', 'script');
tmr.setInput('path', 'test.dacpac');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');
tmr.setInput('additionalArguments', `/op:${outputFile}`);

tmr.registerMock('./src/SqlPackageHelper', {
    default: {
        findSqlPackage: async function() { return '/usr/local/bin/sqlpackage'; }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.dacpac': true, '/usr/local/bin/sqlpackage': true },
    which: { '/usr/local/bin/sqlpackage': '/usr/local/bin/sqlpackage' },
    exec: {}
};

// Exactly one output path argument, and it is the user's.
(a.exec as any)[`/usr/local/bin/sqlpackage /Action:Script /SourceFile:test.dacpac /TargetConnectionString:Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!; /op:${outputFile}`] = {
    code: 0,
    stdout: 'Script generated successfully.'
};

tmr.registerMock('fs', {
    existsSync: (p: string) => p === 'test.dacpac' || p === outputFile,
    statSync: () => ({ isDirectory: () => false }),
    mkdirSync: () => {},
    readdirSync: () => []
});

tmr.setAnswers(a);

tmr.run();
