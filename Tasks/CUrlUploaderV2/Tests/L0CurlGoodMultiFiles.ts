import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'curluploader.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const filesPattern = '/some/path/file*##vso[task.setvariable variable=fromPattern]unsafe';
const firstFile = '/some/path/file1##vsotunsafe';
const secondFile = '/some/path/file2##vso[task.setvariable variable=fromFile]unsafe##vsotunsafe';

tr.setInput('files', filesPattern);
tr.setInput('username', 'user');
tr.setInput('password', 'pass');
tr.setInput('url', 'ftp://some.ftp.com/');
tr.setInput('redirectStderr', 'true');
process.env['SYSTEM_DEBUG'] = 'true';

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "curl": "/usr/local/bin/curl",
        "node": "/usr/local/bin/node"
    },
    "exec": {
        [`curl -T {${firstFile},${secondFile}} ftp://some.ftp.com/ --stderr - -u user:pass`]: {
            "code": 0,
            "stdout": "curl output here"
        }
    },
    "find": {
        "/some/path": [
            firstFile,
            secondFile
        ]
    },
    "match": {
        "*": [
            firstFile,
            secondFile
        ]
    },
};
tr.setAnswers(a);

tr.run();