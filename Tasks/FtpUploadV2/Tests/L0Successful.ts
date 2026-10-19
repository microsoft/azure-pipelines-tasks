import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'ftpuploadtask.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const ftp: any = {
    Client: function () {
        this.ftp = {
            log: () => { }
        };
        this.access = (options: any) => {
            this.ftp.log("ftp logger ##vso[task.setvariable variable=fromLogger]unsafe");
            return {
                message: "ftp greeting ##vso[task.setvariable variable=fromGreeting]unsafe",
            };
        };
        this.trackProgress = (callback: (info: any) => void) => {

        };
        this.send = (cmd: string) => {

        };
        this.ensureDir = (path: string) => { };
        this.removeDir = (path: string) => { };
        this.close = () => { };
    },
    ftp: {},
    access: {},
    trackProgress: {},
    send: {},
    ensureDir: {},
    removeDir: {},
    close: {},
}

tr.setInput('serverEndpoint', 'ID1');
tr.setInput('credsType', 'serviceEndpoint');
process.env["ENDPOINT_URL_ID1"] = "ftp://valid.microsoft.com";
process.env["ENDPOINT_AUTH_ID1"] = "{\"scheme\":\"UsernamePassword\", \"parameters\": {\"username\": \"uname\", \"password\": \"pword\"}}";
process.env["build.sourcesDirectory"] = "/";
process.env["SYSTEM_DEBUG"] = "true";
tr.setInput('rootFolder', 'rootFolder');
tr.setInput('filePatterns', '**\n##vso[task.setvariable variable=fromPattern]unsafe');
tr.setInput('remotePath', '/upload/##vso[task.setvariable variable=fromRemotePath]unsafe');
tr.setInput('clean', 'true');
tr.setInput('overwrite', 'true');
tr.setInput('preservePaths', 'true');
tr.setInput('trustSSL', 'true');
tr.registerMock("basic-ftp", ftp);
// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "exist": {
        "rootFolder": true
    },
    "find": {
        "rootFolder": [
            "rootFolder/##vso[task.setvariable variable=fromPattern]unsafe##vso[task.setvariable variable=fromFile]unsafe",
            "rootFolder/b",
            "rootFolder/c"
        ]
    },
    "match": {
        "*": [
            "rootFolder/##vso[task.setvariable variable=fromPattern]unsafe##vso[task.setvariable variable=fromFile]unsafe"
        ]
    }
};
tr.setAnswers(a);

tr.run();
