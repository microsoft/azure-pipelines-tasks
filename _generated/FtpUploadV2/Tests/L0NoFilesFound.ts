import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'ftpuploadtask.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('credsType', 'inputs');
tr.setInput('serverUrl', 'ftps://');
tr.setInput('username', 'username');
tr.setInput('password', 'password');
tr.setInput('rootFolder', 'rootFolder');
tr.setInput('filePatterns', '**');
tr.setInput('remotePath', '/upload/');
tr.setInput('clean', 'true');
tr.setInput('overwrite', 'true');
tr.setInput('preservePaths', 'true');
tr.setInput('trustSSL', 'true');
process.env["ENDPOINT_URL_ID1"] = "ftp://valid.microsoft.com";
process.env["ENDPOINT_AUTH_ID1"] = "{\"scheme\":\"UsernamePassword\", \"parameters\": {\"username\": \"uname\", \"password\": \"pword\"}}";
process.env["build.sourcesDirectory"] = "/";

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "exist": {
        "rootFolder": true
    },
    "find": {
        "rootFolder": [
        ]
    },
    "match": {
        "*": [
        ]
    }
};
tr.setAnswers(a);

tr.run();
