import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'deployiiswebapp.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('WebSiteName', 'mytestwebsite');
tr.setInput('Package', 'webAppPkg.zip');
tr.setInput('SetParametersFile', 'parameterFilePresent.xml');

process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  "DefaultWorkingDirectory";

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers> {
    "which": {
        "msdeploy": "msdeploy"
    },
    "stats": {
    	"webAppPkg.zip": {
    		"isFile": true
    	},
        "parameterFilePresent.xml": {
            "isFile" : true
        },
        "parameterFileUser.xml": {
            "isFile" : true
        }
    },
    "checkPath": {
        "webAppPkg.zip": true,
        "msdeploy" : true
    },
    "osType": {
        "osType": "Windows"
    },
	 "rmRF": {
        "DefaultWorkingDirectory\\tempSetParameters.xml": {
            "success": true
        }
    },
    "exec": {
        "msdeploy -verb:sync -source:package='webAppPkg.zip' -dest:auto -setParam:name='IIS Web Application Name',value='mytestwebsite' -setParamFile=tempSetParameters.xml  -enableRule:DoNotDeleteRule": {
            "code" : 0,
            "stdout": "Executed Successfully"
        },
        "msdeploy -verb:getParameters -source:package=\'webAppPkg.zip\'": {
            "code" : 0,
            "stdout": "Executed Successfully"
        }
    },
    "exist": {
    	"webAppPkg.zip": true,
        "DefaultWorkingDirectory\\tempSetParameters.xml": true        
    },
    "glob": {
        "webAppPkg.zip": ["webAppPkg.zip"]
    }
};

import mockTask = require('azure-pipelines-task-lib/mock-task');
var msDeployUtility = require('azure-pipelines-tasks-webdeployment-common-v4/msdeployutility.js');

tr.registerMock('azure-pipelines-tasks-webdeployment-common-v4/ziputility.js', {
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
    getMSDeployCmdArgs : msDeployUtility.getMSDeployCmdArgs,
    getMSDeployFullPath : function() {
        var msDeployFullPath =  "msdeploypath\\msdeploy.exe";
        return msDeployFullPath;
    }
});

var fs = require('fs');
tr.registerMock('fs', {
    createWriteStream: function (filePath, options) {
        return { 
            "isWriteStreamObj": true,
            "on": (event) => {
                console.log("event: " + event + " has been triggered");
            },
            "end" : () => { return true; }
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