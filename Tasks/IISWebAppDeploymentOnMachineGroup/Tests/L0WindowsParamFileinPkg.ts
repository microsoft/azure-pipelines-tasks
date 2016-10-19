import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'DeployIISWebApp.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('WebSiteName', 'mytestwebsite');
tr.setInput('Package', 'webAppPkg.zip');
tr.setInput('SetParametersFile', 'parameterFilePresent.xml');

process.env['TASK_TEST_TRACE'] = 1;
process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  "DefaultWorkingDirectory";
process.env["BUILD_SOURCEVERSION"] = "46da24f35850f455185b9188b4742359b537076f";
process.env["BUILD_BUILDID"] = '1',
process.env["RELEASE_RELEASEID"] = '1';
process.env["BUILD_BUILDNUMBER"] = '1';
process.env["RELEASE_RELEASENAME"] = "Release-1";
process.env["BUILD_REPOSITORY_PROVIDER"] = "TfsGit";
process.env["BUILD_REPOSITORY_NAME"] = "MyFirstProject";
process.env["SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"] = "https://abc.visualstudio.com/";
process.env["SYSTEM_TEAMPROJECT"] = "MyFirstProject";
process.env["BUILD_SOURCEVERISONAUTHOR"] = "author";
process.env["RELEASE_RELEASEURI"] = "vstfs:///ReleaseManagement/Release/1";
process.env["AGENT_NAME"] = "author";

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers> {
    "which": {
        "cmd": "cmd"
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
        "cmd" : true
    },
    "osType": {
        "osType": "Windows"
    },
    "exec": {
        "cmd /C DefaultWorkingDirectory\\msDeployCommand.bat": {
            "code" : 0,
            "stdout": "Executed Successfully"
        },
        "cmd /C DefaultWorkingDirectory\\msDeployParam.bat": {
            "code" : 0,
            "stdout": "Executed Successfully"
        }
    },
    "exist": {
    	"webAppPkg.zip": true
    },
    "glob": {
        "webAppPkg.zip": ["webAppPkg.zip"],
        "webAppPkg": ["webAppPkg"]
    },
    "getVariable": {
    	"SYSTEM_DEFAULTWORKINGDIRECTORY": "defaultWorkingDirectory",
        "System.DefaultWorkingDirectory" : "DefaultWorkingDirectory",
        "build.sourcesDirectory": "DefaultWorkingDirectory"
    }
};

import mockTask = require('vsts-task-lib/mock-task');
var msdeployutilitypath = path.join(__dirname,"..","node_modules","msdeploy","msdeployutility.js");
var msDeployUtility = require(msdeployutilitypath);

tr.registerMock('./msdeployutility.js', {
    getMSDeployCmdArgs : msDeployUtility.getMSDeployCmdArgs,
    getMSDeployFullPath : function() {
        var msDeployFullPath =  "msdeploypath\\msdeploy.exe";
        return msDeployFullPath;
    },
    containsParamFile: function(webAppPackage: string) {
        var taskResult = mockTask.execSync("cmd", ['/C',"DefaultWorkingDirectory\\msDeployParam.bat"]);
        return true;
    }
}); 

tr.setAnswers(a);
tr.run();