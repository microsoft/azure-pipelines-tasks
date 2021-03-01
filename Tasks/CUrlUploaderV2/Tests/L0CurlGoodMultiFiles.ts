import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'curluploader.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('files', '/some/path/file*');
tr.setInput('username', 'user');
tr.setInput('password', 'pass');
tr.setInput('url', 'ftp://some.ftp.com/');
tr.setInput('redirectStderr', 'true');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "curl": "/usr/local/bin/curl",
        "node": "/usr/local/bin/node"
    },
    "exec": {
        "curl -T {/some/path/file1,/some/path/file2} ftp://some.ftp.com/ --stderr - -u user:pass": {
            "code": 0,
            "stdout": "curl output here"
        }
    },
    "find": {
        "/some/path": [
            "/some/path/file1",
            "/some/path/file2"
        ]
    },
    "match": {
        "/some/path/file*": [
            "/some/path/file1",
            "/some/path/file2" 
        ]
    },
};
tr.setAnswers(a);

tr.run();