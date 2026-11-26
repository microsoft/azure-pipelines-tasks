// Succeeds when SqlPackage is found via DacFramework MSI on Windows (dynamic version discovery).
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.dacpac');
tmr.setInput('connectionString', 'Server=localhost;Database=testdb;User ID=sa;Password=testpass123;');

const sqlServerBasePath = 'C:\\Program Files\\Microsoft SQL Server';
const dacpacPath = path.join(sqlServerBasePath, '170', 'DAC', 'bin', 'SqlPackage.exe');

const fsClone = Object.assign({}, fs);
fsClone.existsSync = function(filePath: any): boolean {
    const p = filePath ? filePath.toString() : '';
    if (p === sqlServerBasePath) { return true; }          // base path exists
    if (p === dacpacPath) { return true; }                 // SqlPackage.exe found at version 170
    if (p === 'test.dacpac') { return true; }
    if (p.includes('.dotnet')) { return false; }           // dotnet tool not installed
    return false;
};
(fsClone as any).readdirSync = function(dirPath: any): string[] {
    if (dirPath === sqlServerBasePath) {
        return ['Client', '170', '160', 'MSSQL15.SQLEXPRESS'];  // mix of numeric and non-numeric
    }
    return [];
};
tmr.registerMock('fs', fsClone);

const a: ma.TaskLibAnswers = {
    checkPath: {
        'test.dacpac': true,
        [dacpacPath]: true
    },
    which: {
        [dacpacPath]: dacpacPath
    },
    exec: {
        [`${dacpacPath} /Action:Publish /SourceFile:test.dacpac /TargetConnectionString:Server=localhost;Database=testdb;User ID=sa;Password=testpass123;`]: {
            code: 0,
            stdout: 'Successfully published database.'
        }
    }
};
tmr.setAnswers(a);

tmr.run();


