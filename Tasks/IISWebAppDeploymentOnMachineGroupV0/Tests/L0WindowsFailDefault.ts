import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'deployiiswebapp.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('WebSiteName', 'mytestwebsite');
tr.setInput('Package', 'webAppPkg.zip');

process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  "DefaultWorkingDirectory";

// provide answers for task mock
let a: any = <any>{
    "which": {
        "msdeploy": "msdeploy"
    },
    "stats": {
    	"webAppPkg.zip": {
    		"isFile": true
    	}
    },
    "osType": {
        "osType": "Windows"
    },
    "checkPath": {
        "msdeploy": true
    },
    "exec": {
    	"msdeploy -verb:sync -source:package='webAppPkg.zip' -dest:auto -setParam:name='IIS Web Application Name',value='mytestwebsite' -enableRule:DoNotDeleteRule": {
            "code": 1,
            "stdout": "Failed to execute command"
        },
        "msdeploy -verb:getParameters -source:package=\'webAppPkg.zip\'": {
            "code": 0,
            "stdout": "Executed Successfully"
        }
    },
    "exist": {
    	"webAppPkg.zip": true,
        "DefaultWorkingDirectory\\error.txt": true
    },
    "rmRF": {
        "DefaultWorkingDirectory\\error.txt": true
    }
};

import mockTask = require('azure-pipelines-task-lib/mock-task');
var msDeployUtility = require('azure-pipelines-tasks-webdeployment-common/msdeployutility.js');
tr.registerMock('azure-pipelines-tasks-webdeployment-common/ziputility.js', {
    getArchivedEntries: function(webDeployPkg) {
        return {
            "entries": [
                "systemInfo.xml",
                "parameters.xml"
            ]
        };
    }
});

tr.registerMock('./msdeployutility.js', {
    shouldRetryMSDeploy: msDeployUtility.shouldRetryMSDeploy,
    getMSDeployCmdArgs : msDeployUtility.getMSDeployCmdArgs,
    getMSDeployFullPath : function() {
        var msDeployFullPath =  "msdeploypath\\msdeploy.exe";
        return msDeployFullPath;
    },
	redirectMSDeployErrorToConsole : msDeployUtility.redirectMSDeployErrorToConsole
});

var fs = require('fs');
tr.registerMock('fs', {
    createWriteStream: function (filePath, options) {
        var retryFunction;
        return { 
            "isWriteStreamObj": true,
            "on": (name, functionOnFinish) => { retryFunction = functionOnFinish;},
            "end" : () => { 
                if(retryFunction != null) {
                    retryFunction(); 
                }  
                return true; 
            }
        };
    },
    readFileSync: function (msDeployErrorFilePath) {
        console.log("reading the error file");
        return "ERROR DEPLOYING WEBSITE";
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
    }
});

tr.setAnswers(a);
tr.run();