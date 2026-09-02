// A directory named with a supported extension must be rejected as an input.
//
// tl.checkPath only tests existence, so `migration.sql/` satisfies it and used to be handed
// straight to the external tool. The previous version of this test mocked checkPath to return
// false, which models a path that does not exist - a case L0PathDoesNotExist already covers - so it
// never exercised directory handling at all.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// An existing directory that happens to carry a supported extension.
const directoryPath = '/path/to/migration.sql';

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', directoryPath);
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=testpass123;');

tmr.registerMock('./src/SqlcmdHelper', {
    default: {
        findSqlcmd: async function() { return '/usr/bin/sqlcmd'; }
    }
});

const fsClone: any = Object.assign({}, fs);
fsClone.existsSync = function(p: any): boolean {
    return p === directoryPath;
};
fsClone.statSync = function(p: any): any {
    if (p === directoryPath) {
        return { isDirectory: () => true, isFile: () => false };
    }
    return { isDirectory: () => false, isFile: () => true };
};
tmr.registerMock('fs', fsClone);

const a: ma.TaskLibAnswers = {
    // The path exists, which is all tl.checkPath asks. The directory check is what has to reject it.
    checkPath: { [directoryPath]: true, '/usr/bin/sqlcmd': true },
    which: { '/usr/bin/sqlcmd': '/usr/bin/sqlcmd' },
    // No exec answers: reaching the tool at all is the defect.
    exec: {}
};
tmr.setAnswers(a);

tmr.run();
