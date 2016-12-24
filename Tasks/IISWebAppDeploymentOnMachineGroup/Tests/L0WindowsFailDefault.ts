import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'deployiiswebapp.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('WebSiteName', 'mytestwebsite');
tr.setInput('Package', 'webAppPkg.zip');

process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  "DefaultWorkingDirectory";

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
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
    "glob": {
        "webAppPkg.zip": ["webAppPkg.zip"]
    },
    "rmRF": {
        "DefaultWorkingDirectory\\error.txt": true
    }
};

import mockTask = require('vsts-task-lib/mock-task');
var msDeployUtility = require('webdeployment-common/msdeployutility.js');

tr.registerMock('./msdeployutility.js', {
    getMSDeployCmdArgs : msDeployUtility.getMSDeployCmdArgs,
    getMSDeployFullPath : function() {
        var msDeployFullPath =  "msdeploypath\\msdeploy.exe";
        return msDeployFullPath;
    },
    containsParamFile: function(webAppPackage: string) {
		var taskResult = mockTask.execSync("msdeploy", "-verb:getParameters -source:package=\'" + webAppPackage + "\'");
        return true;
    },
	redirectMSDeployErrorToConsole : msDeployUtility.redirectMSDeployErrorToConsole
});

tr.registerMock('fs', {
    createWriteStream: function (filePath) {
        return { "isWriteStreamObj": true };
    },

    readFileSync: function(msDeployErrorFilePath) {
        console.log("reading the error file");
        return "ERROR DEPLOYING WEBSITE";
    }
});

tr.setAnswers(a);
tr.run();