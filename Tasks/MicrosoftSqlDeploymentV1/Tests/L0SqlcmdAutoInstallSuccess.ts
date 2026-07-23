// Succeeds when sqlcmd is not on PATH and is auto-installed from go-sqlcmd releases.
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', 'test.sql');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=testpass123;');

const extractedDir = '/tmp/sqlcmd-extracted';
const executableName = process.platform === 'win32' ? 'sqlcmd.exe' : 'sqlcmd';
const sqlcmdExePath = path.join(extractedDir, executableName);

// Mock azure-pipelines-tool-lib/tool to simulate successful download and extraction
tmr.registerMock('azure-pipelines-tool-lib/tool', {
    downloadTool: async (_url: string) => '/tmp/sqlcmd-download',
    extractZip: async (_file: string) => extractedDir,
    extractTar: async (_file: string) => extractedDir
});

const fsClone = Object.assign({}, fs);
fsClone.existsSync = function(filePath: any): boolean {
    const p = filePath ? filePath.toString() : '';
    if (p === sqlcmdExePath) { return true; }   // extracted executable exists
    if (p === 'test.sql') { return true; }
    if (p.includes('.dotnet')) { return false; } // dotnet tool not installed
    return false;
};
(fsClone as any).chmodSync = function() {};      // no-op chmod
tmr.registerMock('fs', fsClone);

// sqlcmd not on PATH — triggers auto-install
tmr.setAnswers({ which: { 'sqlcmd': '' }, checkPath: { 'test.sql': true } });

tmr.run();


