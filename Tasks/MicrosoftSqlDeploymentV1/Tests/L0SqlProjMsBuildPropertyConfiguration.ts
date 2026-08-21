// MSBuild property syntax must not send the task looking for the .dacpac in the wrong place.
//
// -p:Configuration=Release builds Release, but the old lookup only understood --configuration and
// so searched bin/Debug. The same applied to --property:Configuration and to an OutputPath set
// inside the project file, none of which can be recovered by parsing the command line. The task
// now pins the output directory and passes it last, where MSBuild lets it win, so the location is
// known rather than predicted.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');
import fs = require('fs');

// task-lib writes its secret vault into Agent.TempDirectory, so this has to be a real directory.
const tempDir = os.tmpdir();
process.env['AGENT_TEMPDIRECTORY'] = tempDir;

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const outputDir = path.join(tempDir, 'sqlproj-build-output', 'test');
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

// The pinned -p:OutputPath comes after the user's -p:Configuration, because MSBuild takes the last
// value for a property.
(a.exec as any)[`/usr/bin/dotnet build test.sqlproj -p:NetCoreBuild=true -p:Configuration=Release -p:OutputPath=${outputDir}${path.sep}`] = {
    code: 0,
    stdout: 'Build succeeded.'
};

// The build without a pinned output directory also succeeds, so that this test turns on where the
// .dacpac is looked for afterwards rather than on which arguments were passed.
(a.exec as any)['/usr/bin/dotnet build test.sqlproj -p:NetCoreBuild=true -p:Configuration=Release'] = {
    code: 0,
    stdout: 'Build succeeded.'
};

(a.exec as any)[`/usr/local/bin/sqlpackage /Action:Publish /SourceFile:${dacpacPath} /TargetConnectionString:Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;`] = {
    code: 0,
    stdout: 'Successfully published database.'
};

tmr.setAnswers(a);

tmr.run();
