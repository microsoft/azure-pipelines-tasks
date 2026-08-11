// An unset filePath input is rooted by the agent, so it arrives as the default
// working directory rather than an empty string. The task must treat that as
// "not specified" instead of trying to execute the directory as sqlcmd.
//
// Regression test for the canary failure:
//   Unable to locate executable file: 'D:\a\1\s'
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// This directory exists, exactly like the agent working directory does.
const workingDir = __dirname;

// tl.filePathSupplied compares the input against the repo root, so the working directory has
// to be set for the "user left it blank" case to be reproduced rather than assumed.
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = workingDir;
process.env['BUILD_SOURCESDIRECTORY'] = workingDir;

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', 'test.sql');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');
// The agent supplies the working directory for filePath inputs the user left blank.
tmr.setInput('sqlcmdPath', workingDir);
tmr.setInput('sqlpackagePath', workingDir);

// Discovery must still run: if the directory were treated as a user-provided path,
// findSqlcmd would return it and never reach here.
tmr.registerMock('./src/SqlcmdHelper', {
    default: {
        findSqlcmd: async function(sqlcmdPathInput?: string) {
            if (sqlcmdPathInput) {
                throw new Error(`sqlcmdPath should have been ignored, got: ${sqlcmdPathInput}`);
            }
            return '/usr/bin/sqlcmd';
        }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.sql': true, '/usr/bin/sqlcmd': true },
    which: { '/usr/bin/sqlcmd': '/usr/bin/sqlcmd' },
    exec: {
        // The password is passed via environment rather than on the command line.
        '/usr/bin/sqlcmd -S localhost -d testdb -U sa -l 30 -b -i test.sql': {
            code: 0,
            stdout: 'Changed database context to testdb.'
        }
    }
};
tmr.setAnswers(a);

tmr.run();
