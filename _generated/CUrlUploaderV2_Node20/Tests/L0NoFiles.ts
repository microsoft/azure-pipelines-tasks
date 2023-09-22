import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'curluploader.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('url', 'ftp://some.ftp.com/');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "curl": "/usr/local/bin/curl",
        "node": "/usr/local/bin/node"
    },
    "exec": {
        "curl -T /some/path/one ftp://some.ftp.com/ --stderr - -u user:pass": {
            "code": 0,
            "stdout": "curl output here"
        }
    },
    "checkPath": {
        "/some/path/one": true
    }
};
tr.setAnswers(a);

tr.run();