import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'deployiiswebapp.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('WebSiteName', 'mytestwebsite');
tr.setInput('Package', 'webAppPkg.zip');
tr.setInput('SetParametersFile', 'invalidparameterFile.xml');

process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  "DefaultWorkingDirectory";

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers> {
    "stats": {
    	"webAppPkg.zip": {
    		"isFile": true
    	},
        "invalidparameterFile.xml": {
            "isFile" : false
        }
    },
    "exist": {
    	"webAppPkg.zip": true
    }
};

import mockTask = require('azure-pipelines-task-lib/mock-task');
var msDeployUtility = require('azure-pipelines-tasks-webdeployment-common-v4/msdeployutility.js');

var fs = require('fs');
tr.registerMock('fs', {
    createWriteStream: function (filePath, options) {
        return { "isWriteStreamObj": true };
    },
    ReadStream: fs.ReadStream,
    WriteStream: fs.WriteStream,
    openSync: function (fd, options) {
        return true;
    },
    closeSync: function (fd) {
        return true;
    },
    fsyncSync: function(fd) {
        return true;
    },
    fstat: fs.fstat,
    read: fs.read,
    open: fs.open,
    writeFile: fs.writeFile,
    symlink: fs.symlink,
    stat: fs.stat
});

tr.setAnswers(a);
tr.run();