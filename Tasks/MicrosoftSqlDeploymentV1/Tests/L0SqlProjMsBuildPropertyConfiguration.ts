// MSBuild property syntax must not send the task looking for the .dacpac in the wrong place.
//
// The task must use MSBuild's evaluated output rather than guessing bin/Debug or overriding
// project properties with a task-owned directory.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const outputDir = path.resolve('bin', 'Release');
const dacpacPath = path.join(outputDir, 'test.dacpac');

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.sqlproj');
tmr.setInput('buildArguments', '-p:Configuration=Release');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');

tmr.registerMock('./src/SqlPackageHelper', {
    default: {
        findSqlPackage: async function() { return '/usr/local/bin/sqlpackage'; }
    }
});

// The build is mocked, so nothing writes the file the builder then looks for.
const fsClone: any = Object.assign({}, fs);
fsClone.existsSync = function(filePath: any): boolean {
    return filePath === dacpacPath;
};
tmr.registerMock('fs', fsClone);

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.sqlproj': true, '/usr/local/bin/sqlpackage': true, '/usr/bin/dotnet': true },
    which: { 'dotnet': '/usr/bin/dotnet', '/usr/local/bin/sqlpackage': '/usr/local/bin/sqlpackage' },
    exec: {}
};

(a.exec as any)['/usr/bin/dotnet build test.sqlproj -p:NetCoreBuild=true -p:Configuration=Release'] = {
    code: 0,
    stdout: 'Build succeeded.'
};
(a.exec as any)['/usr/bin/dotnet build test.sqlproj -p:NetCoreBuild=true -p:Configuration=Release -getProperty:SqlTargetPath,MSBuildProjectDirectory'] = {
    code: 0,
    stdout: JSON.stringify({
        Properties: { SqlTargetPath: dacpacPath, MSBuildProjectDirectory: process.cwd() }
    })
};

(a.exec as any)[`/usr/local/bin/sqlpackage /Action:Publish /SourceFile:${dacpacPath} /TargetConnectionString:Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;`] = {
    code: 0,
    stdout: 'Successfully published database.'
};

tmr.setAnswers(a);

tmr.run();
