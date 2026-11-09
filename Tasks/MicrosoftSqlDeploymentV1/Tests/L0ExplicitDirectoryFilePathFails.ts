// An explicitly supplied publishProfile that points at a directory must fail, not be ignored.
//
// The earlier fix for agent-rooted filePath inputs discarded every directory, so a user who
// pointed publishProfile at a folder got a green run: SqlPackage was invoked without /Profile
// and deployed with default properties instead of the requested profile.
//
// tl.filePathSupplied separates the two cases. Here the input differs from the repo root, so it
// is genuinely supplied and the task must report it.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// The repo root, which is what an unsupplied filePath input would resolve to.
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = path.join(__dirname, '..');
process.env['BUILD_SOURCESDIRECTORY'] = path.join(__dirname, '..');

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.dacpac');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');
// A real directory, and deliberately not the repo root, so it reads as user-supplied.
tmr.setInput('publishProfile', __dirname);

tmr.registerMock('./src/SqlPackageHelper', {
    default: {
        findSqlPackage: async function() { return '/usr/local/bin/sqlpackage'; }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.dacpac': true, '/usr/local/bin/sqlpackage': true },
    which: { '/usr/local/bin/sqlpackage': '/usr/local/bin/sqlpackage' },
    // No SqlPackage entry: deploying without the requested profile is the bug being guarded against.
    exec: {}
};
tmr.setAnswers(a);

tmr.run();
