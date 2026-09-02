// 'script' is a SqlPackage action and is invalid for a .sql file. The task must reject the
// combination before any tool discovery so no download/auto-install work is triggered.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'script');
tmr.setInput('path', 'test.sql');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');

// Fails the test if discovery is reached — validation must happen first.
tmr.registerMock('./src/SqlcmdHelper', {
    default: {
        findSqlcmd: async function() {
            throw new Error('sqlcmd discovery must not run for an invalid action/file-type combination');
        }
    }
});

tmr.registerMock('./src/SqlPackageHelper', {
    default: {
        findSqlPackage: async function() {
            throw new Error('SqlPackage discovery must not run for an invalid action/file-type combination');
        }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.sql': true },
    which: {},
    exec: {}
};
tmr.setAnswers(a);

tmr.run();
