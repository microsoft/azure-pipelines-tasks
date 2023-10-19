import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'ftpuploadtask.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('credsType', 'serviceEndpoint');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "getVariable": {
        "ENDPOINT_URL_ID1": "ftp://valid.microsoft.com",
        "ENDPOINT_AUTH_ID1": "{\"scheme\":\"UsernamePassword\", \"parameters\": {\"username\": \"uname\", \"password\": \"pword\"}}",
        "build.sourcesDirectory": "/"
    },
    "exist" : {
        "rootFolder": true
    },
    "find": {
        "rootFolder": [
            "rootFolder/a",
            "rootFolder/b",
            "rootFolder/c"
        ]
    },
    "match": {
        "*": [
            "rootFolder/a",
            "rootFolder/b",
            "rootFolder/c"
        ]
    }
};
tr.setAnswers(a);

tr.run();