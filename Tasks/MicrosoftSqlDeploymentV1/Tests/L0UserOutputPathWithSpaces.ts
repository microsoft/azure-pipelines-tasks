// A user-specified /OutputPath containing spaces must reach SqlPackage as one argument with no
// quote characters in it.
//
// Quoting is the documented way to pass such a path, but the parser used to keep the quote
// characters, so SqlPackage received /OutputPath:"C:\out dir\x.sql" verbatim and rejected it as
// containing illegal path characters.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const outputFile = '/tmp/out dir/deploy script.sql';

tmr.setInput('action', 'script');
tmr.setInput('path', 'test.dacpac');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');
tmr.setInput('additionalArguments', `/OutputPath:"${outputFile}"`);

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

// Unquoted in the expected command: the quotes were syntax, not part of the value.
(a.exec as any)[`/usr/local/bin/sqlpackage /Action:Script /SourceFile:test.dacpac /TargetConnectionString:Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!; /OutputPath:${outputFile}`] = {
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
