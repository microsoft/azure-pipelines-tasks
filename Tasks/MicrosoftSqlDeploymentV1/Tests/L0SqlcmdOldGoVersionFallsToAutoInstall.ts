import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');

const taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', 'test.sql');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=TestPass123!;');

const extractedDir = '/tmp/sqlcmd-extracted';
const executableName = process.platform === 'win32' ? 'sqlcmd.exe' : 'sqlcmd';
const installedSqlcmdPath = path.join(extractedDir, executableName);
const pathSqlcmd = '/usr/bin/sqlcmd';

tmr.registerMock('azure-pipelines-tool-lib/tool', {
    downloadTool: async (_url: string) => '/tmp/sqlcmd-download',
    extractZip: async (_file: string) => extractedDir,
    extractTar: async (_file: string) => extractedDir
});

const fsClone = Object.assign({}, fs);
fsClone.existsSync = function(filePath: any): boolean {
    const candidate = filePath ? filePath.toString() : '';
    return candidate === installedSqlcmdPath || candidate === 'test.sql';
};
(fsClone as any).chmodSync = function() {};
tmr.registerMock('fs', fsClone);

const answers: ma.TaskLibAnswers = {
    checkPath: { 'test.sql': true, [installedSqlcmdPath]: true },
    which: {
        'sqlcmd': pathSqlcmd,
        [installedSqlcmdPath]: installedSqlcmdPath
    },
    exec: {
        [`${pathSqlcmd} --version`]: {
            code: 0,
            stdout: 'sqlcmd - the Microsoft SQL Server command line utility (go-sqlcmd)\nVersion: 1.9.0'
        },
        [`${installedSqlcmdPath} -S localhost -d testdb -U sa -l 30 -b -i test.sql`]: {
            code: 0,
            stdout: 'Changed database context to testdb.'
        }
    }
};
tmr.setAnswers(answers);

tmr.run();