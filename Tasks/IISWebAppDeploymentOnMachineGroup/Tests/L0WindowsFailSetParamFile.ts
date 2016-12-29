import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
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
    },
    "glob": {
        "webAppPkg.zip": ["webAppPkg.zip"]
    }
};

import mockTask = require('vsts-task-lib/mock-task');
var msDeployUtility = require('webdeployment-common/msdeployutility.js');

tr.setAnswers(a);
tr.run();