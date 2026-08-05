// Verifies the auto-generated /OutputPath is quoted so a temp directory containing
// spaces is not split into multiple arguments by parseAdditionalArguments().
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');
import realFs = require('fs');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Temp directory deliberately contains a space. It must exist on disk because
// azure-pipelines-task-lib writes a .taskkey file there when it loads.
const tempDir = path.join(os.tmpdir(), 'agent work', '_temp');
realFs.mkdirSync(tempDir, { recursive: true });
process.env['AGENT_TEMPDIRECTORY'] = tempDir;

// Freeze the timestamp so the auto-generated file name is deterministic.
const FIXED_TIMESTAMP = 1700000000000;
Date.now = () => FIXED_TIMESTAMP;

const expectedOutputFile = path.join(tempDir, 'GeneratedOutputFiles', `script_${FIXED_TIMESTAMP}.sql`);

tmr.setInput('action', 'script');
tmr.setInput('path', 'test.dacpac');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');
// No additionalArguments - forces the auto-generated /OutputPath branch.

tmr.registerMock('./src/SqlPackageHelper', {
    default: {
        findSqlPackage: async function() {
            return '/usr/local/bin/sqlpackage';
        }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: {
        'test.dacpac': true,
        '/usr/local/bin/sqlpackage': true
    },
    which: {
        '/usr/local/bin/sqlpackage': '/usr/local/bin/sqlpackage'
    },
    exec: {}
};

// The path must arrive as a single quoted argument, not split on the space.
(a.exec as any)[`/usr/local/bin/sqlpackage /Action:Script /SourceFile:test.dacpac /TargetConnectionString:Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!; /OutputPath:"${expectedOutputFile}"`] = {
    code: 0,
    stdout: 'Script generated successfully.'
};

tmr.registerMock('fs', {
    existsSync: (p: string) => {
        if (p === 'test.dacpac') { return true; }
        if (p === expectedOutputFile) { return true; }
        return false;
    },
    mkdirSync: () => {},
    readdirSync: () => []
});

tmr.setAnswers(a);

tmr.run();
