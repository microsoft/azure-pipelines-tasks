import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'deployiiswebapp.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('WebSiteName', 'mytestwebsite');
tr.setInput('Package', 'webAppPkg.zip');

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

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "cmd": "cmd"
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
        "cmd": true
    },
    "exec": {
    	"cmd /C DefaultWorkingDirectory\\msDeployCommand.bat": {
            "code": 1,
            "stdout": "Failed to execute command"
        },
        "cmd /C DefaultWorkingDirectory\\msDeployParam.bat": {
            "code": 0,
            "stdout": "Executed Successfully"
        }
    },
    "exist": {
    	"webAppPkg.zip": true
    },
    "glob": {
        "webAppPkg.zip": ["webAppPkg.zip"]
    },
    "getVariable": {
    	"SYSTEM_DEFAULTWORKINGDIRECTORY" : "defaultWorkingDirectory",
        "System.DefaultWorkingDirectory" : "DefaultWorkingDirectory",
		"release.releaseId": '1',
		"release.releaseName": "Release-1",
		"system.TeamFoundationCollectionUri": "https://abc.visualstudio.com/",
		"system.teamProject": "MyFirstProject",
		"release.releaseUri": "vstfs:///ReleaseManagement/Release/1",
		"agent.name": "agent"
    }
};

var msDeployUtility = require('webdeployment-common/msdeployutility.js');
tr.registerMock('./msdeployutility.js', {
    getMSDeployCmdArgs : msDeployUtility.getMSDeployCmdArgs,
    getMSDeployFullPath : function() {
        var msDeployFullPath =  "msdeploypath\\msdeploy.exe";
        return msDeployFullPath;
    },
    containsParamFile: function(webAppPackage: string) {
        return true;
    },
	redirectMSDeployErrorToConsole : msDeployUtility.redirectMSDeployErrorToConsole
}); 

tr.setAnswers(a);
tr.run();