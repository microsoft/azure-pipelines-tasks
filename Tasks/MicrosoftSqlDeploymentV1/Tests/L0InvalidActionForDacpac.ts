// 'sqlScript' is invalid for a .dacpac file and must be rejected before tool discovery.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', 'test.dacpac');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');

tmr.registerMock('./src/SqlPackageHelper', {
    default: {
        findSqlPackage: async function() {
            throw new Error('SqlPackage discovery must not run for an invalid action/file-type combination');
        }
    }
});

tmr.registerMock('./src/SqlcmdHelper', {
    default: {
        findSqlcmd: async function() {
            throw new Error('sqlcmd discovery must not run for an invalid action/file-type combination');
        }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.dacpac': true },
    which: {},
    exec: {}
};
tmr.setAnswers(a);

tmr.run();
