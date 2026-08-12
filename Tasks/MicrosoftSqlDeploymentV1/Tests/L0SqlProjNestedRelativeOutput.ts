// A nested project with a relative --output must be searched where dotnet actually writes it.
//
// dotnet resolves --output against the current directory, not the project directory. Resolving it
// against the project meant `dotnet build src/App/App.sqlproj --output out` built successfully into
// ./out while the task looked in src/App/out and reported the dacpac missing. The single-quoted
// value also has to survive tokenization: matching quotes only at the start of a token truncated it.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Nested, so resolving against the project directory gives a different answer than against cwd.
const projectPath = path.join('src', 'App', 'App.sqlproj');
const outputDir = path.resolve(process.cwd(), 'out dir');
const dacpacPath = path.join(outputDir, 'App.dacpac');

tmr.setInput('action', 'publish');
tmr.setInput('path', projectPath);
tmr.setInput('buildArguments', `--output 'out dir'`);
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');

tmr.registerMock('./src/SqlPackageHelper', {
    default: {
        findSqlPackage: async function() { return '/usr/local/bin/sqlpackage'; }
    }
});

// The build is mocked, so nothing writes the file the builder then looks for.
const fsClone: any = Object.assign({}, fs);
fsClone.existsSync = function(p: any): boolean {
    return p === dacpacPath;
};
tmr.registerMock('fs', fsClone);

const a: ma.TaskLibAnswers = {
    checkPath: { [projectPath]: true, '/usr/local/bin/sqlpackage': true, '/usr/bin/dotnet': true },
    which: { 'dotnet': '/usr/bin/dotnet', '/usr/local/bin/sqlpackage': '/usr/local/bin/sqlpackage' },
    exec: {}
};

// The quotes are gone and the value stays one argument. No -p:OutputPath is appended, because the
// user chose the directory and an explicit choice is never replaced.
(a.exec as any)[`/usr/bin/dotnet build ${projectPath} -p:NetCoreBuild=true --output out dir`] = {
    code: 0,
    stdout: 'Build succeeded.'
};

(a.exec as any)[`/usr/local/bin/sqlpackage /Action:Publish /SourceFile:${dacpacPath} /TargetConnectionString:Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;`] = {
    code: 0,
    stdout: 'Successfully published database.'
};

tmr.setAnswers(a);

tmr.run();
