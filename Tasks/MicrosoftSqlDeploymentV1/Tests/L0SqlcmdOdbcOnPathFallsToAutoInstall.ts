// Succeeds when ODBC sqlcmd (mssql-tools) is on PATH but the task detects it is not
// go-sqlcmd and auto-installs go-sqlcmd instead.
//
// Scenario: Microsoft-hosted Linux agents ship ODBC sqlcmd on PATH.
// SqlcmdHelper.findSqlcmd() calls `sqlcmd --version` on the PATH binary; the ODBC
// variant does NOT print "sqlcmd version X.X.X", so isGoSqlcmd() returns false.
// The task then auto-installs go-sqlcmd from GitHub releases and uses that instead.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', 'test.sql');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');

// Do NOT mock SqlcmdHelper — we want to exercise the real variant-detection logic.

const extractedDir = '/tmp/sqlcmd-extracted';
const executableName = process.platform === 'win32' ? 'sqlcmd.exe' : 'sqlcmd';
const goSqlcmdPath = path.join(extractedDir, executableName);
const odbcSqlcmdPath = '/usr/bin/sqlcmd';

// Mock tool-lib: simulate successful download and extraction of go-sqlcmd
tmr.registerMock('azure-pipelines-tool-lib/tool', {
    downloadTool: async (_url: string) => '/tmp/sqlcmd-download',
    extractZip: async (_file: string) => extractedDir,
    extractTar: async (_file: string) => extractedDir
});

const fsClone = Object.assign({}, fs);
fsClone.existsSync = function(filePath: any): boolean {
    const p = filePath ? filePath.toString() : '';
    if (p === goSqlcmdPath) { return true; }  // auto-installed go-sqlcmd exists
    if (p === 'test.sql')   { return true; }
    return false;
};
(fsClone as any).chmodSync = function() {};
tmr.registerMock('fs', fsClone);

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.sql': true, [goSqlcmdPath]: true },
    which: {
        // ODBC sqlcmd is on PATH — but isGoSqlcmd() will reject it
        'sqlcmd': odbcSqlcmdPath,
        [goSqlcmdPath]: goSqlcmdPath
    },
    exec: {
        // ODBC sqlcmd --version does NOT print "sqlcmd version X.X.X" or "Version: X"
        // → isGoSqlcmd step 1 fails, falls through to step 2 (-?)
        [`${odbcSqlcmdPath} --version`]: {
            code: 0,
            stdout: 'Microsoft (R) SQL Server Command Line Tool\nVersion 17.10.0001.1'
        },
        // ODBC sqlcmd -? prints the "Microsoft (R)" banner → isGoSqlcmd returns false
        [`${odbcSqlcmdPath} -?`]: {
            code: 0,
            stdout: 'Microsoft (R) SQL Server Command Line Tool\nVersion 17.10.0001.1'
        },
        // go-sqlcmd runs the script after auto-install
        [`${goSqlcmdPath} -S localhost -d testdb -U sa -l 30 -b -i test.sql`]: {
            code: 0,
            stdout: 'Changed database context to testdb.'
        }
    }
};
tmr.setAnswers(a);

tmr.run();
