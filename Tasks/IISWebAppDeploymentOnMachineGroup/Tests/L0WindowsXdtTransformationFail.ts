import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'deployiiswebapp.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
tr.setInput('WebSiteName', 'mytestwebsite');
tr.setInput('Package', 'webAppPkg.zip');
tr.setInput('XmlTransformation', 'true');

process.env['TASK_TEST_TRACE'] = 1;
process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  "DefaultWorkingDirectory";
process.env["BUILD_SOURCEVERSION"] = "46da24f35850f455185b9188b4742359b537076f";
process.env["BUILD_BUILDID"] = 1,
process.env["RELEASE_RELEASEID"] = 1;
process.env["BUILD_BUILDNUMBER"] = 1;
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
        "cmd": true,
        "webAppPkg.zip": true,
        "webAppPkg": true
    },
    "exec": {
        "cmd /C DefaultWorkingDirectory\\msDeployCommand.bat": {
            "code": 0,
            "stdout": "Executed Successfully"
        },
        "cmd /C DefaultWorkingDirectory\\msDeployParam.bat": {
            "code": 0,
            "stdout": "Executed Successfully"
        },
        "cmd /C DefaultWorkingDirectory\\cttCommand.bat": {
            "code": 1,
            "stderr": "ctt execution failed"
        }
    },
    "exist": {
    	"webAppPkg.zip": true,
        "webAppPkg": true
    }, 
    "glob": {
        "webAppPkgPattern" : ["webAppPkg1", "webAppPkg2"],
        "Invalid_webAppPkg" : [],
        "webAppPkg.zip": ["webAppPkg.zip"],
        "webAppPkg": ["webAppPkg"],
        "DefaultWorkingDirectory\\temp_web_package_folder\\**\\*.config": ["path1/web.config", "path1/web.Release.config", "path1/web.Debug.config", "path2/web.config", "path2/web.Debug.config"],
        "DefaultWorkingDirectory/temp_web_package_folder/**/*.config": ["web.config", "web.Release.config", "web.Debug.config"]
    },
    "getVariable": {
        "System.DefaultWorkingDirectory": "DefaultWorkingDirectory",
		"build.sourceVersion": "46da24f35850f455185b9188b4742359b537076f",
		"build.buildId": 1,
		"release.releaseId": 1,
		"build.buildNumber": 1,
		"release.releaseName": "Release-1",
		"build.repository.provider": "TfsGit",
		"build.repository.name": "MyFirstProject",
		"system.TeamFoundationCollectionUri": "https://abc.visualstudio.com/",
		"system.teamProject": "MyFirstProject",
		"build.sourceVersionAuthor": "author",
		"release.releaseUri": "vstfs:///ReleaseManagement/Release/1",
		"agent.name": "agent"
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
        var taskResult = mockTask.execSync("cmd", ['/C',"DefaultWorkingDirectory\\msDeployParam.bat"]);
        return true;
    }
}); 

tr.registerMock('webdeployment-common/ziputility.js', {
    unzip: function() {

    },
    archiveFolder: function() {
        return "DefaultWorkingDirectory\\temp_web_package.zip"
    }
});

tr.setAnswers(a);
tr.run();