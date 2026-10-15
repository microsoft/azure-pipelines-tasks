// When an option is repeated, the dacpac must be looked for where MSBuild actually wrote it.
//
// MSBuild applies the last value of a repeated property, but the detector returned the first one.
// The build then wrote into the second directory while the task searched the first, so a stale
// dacpac left there by an earlier build was accepted and deployed in place of the new one.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const projectPath = 'App.sqlproj';
// MSBuild resolves OutputPath against the project directory.
const effectiveOutputDir = path.resolve(path.dirname(projectPath), 'second');
const dacpacPath = path.join(effectiveOutputDir, 'App.dacpac');

tmr.setInput('action', 'publish');
tmr.setInput('path', projectPath);
tmr.setInput('buildArguments', '-p:OutputPath=first -p:OutputPath=second');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');

tmr.registerMock('./src/SqlPackageHelper', {
    default: {
        findSqlPackage: async function() { return '/usr/local/bin/sqlpackage'; }
    }
});

// Only the last-wins location holds a dacpac. Reading the first value reports it as missing
// rather than silently deploying whatever happens to be there.
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

// Both values are still passed through untouched; MSBuild decides which one applies.
(a.exec as any)[`/usr/bin/dotnet build ${projectPath} -p:NetCoreBuild=true -p:OutputPath=first -p:OutputPath=second`] = {
    code: 0,
    stdout: 'Build succeeded.'
};

(a.exec as any)[`/usr/local/bin/sqlpackage /Action:Publish /SourceFile:${dacpacPath} /TargetConnectionString:Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;`] = {
    code: 0,
    stdout: 'Successfully published database.'
};

tmr.setAnswers(a);

tmr.run();
