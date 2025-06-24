import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'powershell.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('targetType', 'inline');
tmr.setInput('script', `
Write-Warning "a) Default: Shows = true & Expected = true"
Write-Warning "b) SilentlyContinue: Shows = false & Expected = false" -WarningAction SilentlyContinue
Write-Warning "c) Ignore: Shows = false & Expected = false" -WarningAction Ignore
Write-Warning "d) Redirect null: Shows = false & Expected = false" 3> $null
Write-Warning "e) Redirect file: Shows = false & Expected = false" 3> "warnings.txt"
`);
tmr.setInput('workingDirectory', '/fakecwd');
tmr.setInput('ignoreLASTEXITCODE', 'true');
tmr.setInput('showWarnings', 'true');

//Create assertAgent and getVariable mocks, support not added in this version of task-lib
const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.getVariable = function(variable: string) {
    if (variable.toLowerCase() == 'agent.tempdirectory') {
        return 'temp/path';
    }
    return null;
};
tlClone.assertAgent = function(variable: string) {
    return;
};
tmr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

// Mock task-lib
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'checkPath' : {
        '/fakecwd' : true,
        'path/to/powershell': true,
        'temp/path': true
    },
    'which': {
        'powershell': 'path/to/powershell'
    },
    'assertAgent': {
        '2.115.0': true
    },
    'exec': {
        'path/to/powershell --noprofile --norc -c pwd': {
            "code": 0,
            "stdout": "temp/path"
        },
        "path/to/powershell -NoLogo -NoProfile -NonInteractive -Command . 'temp\\path\\fileName.ps1'": {
            "code": 0,
            "stdout": "##vso[task.logissue type=warning;]a) Default: Shows = true & Expected = true\nWARNING: a) Default: Shows = true & Expected = true"
        },
        "path/to/powershell -NoLogo -NoProfile -NonInteractive -Command . 'temp/path/fileName.ps1'": {
            "code": 0,
            "stdout": "##vso[task.logissue type=warning;]a) Default: Shows = true & Expected = true\nWARNING: a) Default: Shows = true & Expected = true"
        }
    },
    'stats': {
        'path/to/script.ps1': {
            isFile() {
                return true;
            }
        }
    }
};
tmr.setAnswers(a);

// Mock fs
const fs = require('fs');
const fsClone = Object.assign({}, fs);
fsClone.writeFileSync = function(filePath, contents, options) {
    // Normalize to linux paths for logs we check
    console.log(`Writing ${contents} to ${filePath.replace(/\\/g, '/')}`);
}
tmr.registerMock('fs', fsClone);

// Mock uuidv4
tmr.registerMock('uuid/v4', function () {
    return 'fileName';
});

tmr.run();