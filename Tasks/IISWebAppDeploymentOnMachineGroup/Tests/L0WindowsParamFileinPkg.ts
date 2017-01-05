import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'deployiiswebapp.js');
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
    }
});

tr.registerMock('./utility.js', {
    copySetParamFileIfItExists: function(setParamFile) {
        return "defaultWorkingDirectory\\tempSetParameters.xml"
    }
})

var fs = require('fs');

tr.registerMock('fs', {
    createWriteStream: function (fd, options) {
        return true;
    },
    ReadStream: fs.ReadStream,
    WriteStream: fs.WriteStream,
    openSync: function( fd, options) {
        return true;
    },
    closeSync: function(fd) {
        return true;
    },
    fsyncSync: function( fd ) {
        return true;
    }
});

tr.setAnswers(a);
tr.run();