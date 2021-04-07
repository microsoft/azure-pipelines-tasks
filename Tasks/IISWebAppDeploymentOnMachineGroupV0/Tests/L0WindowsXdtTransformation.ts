import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'deployiiswebapp.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
tr.setInput('WebSiteName', 'mytestwebsite');
tr.setInput('Package', 'webAppPkg.zip');
tr.setInput('XmlTransformation', 'true');

process.env['TASK_TEST_TRACE'] = "1";
process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  "DefaultWorkingDirectory";
process.env['SYSTEM_DEBUG'] = "false";

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "cmd": "cmd",
        "msdeploy": "msdeploy",
        "DefaultWorkingDirectory/ctt/ctt.exe": "DefaultWorkingDirectory/ctt/ctt.exe"
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
        "webAppPkg": true,
        "msdeploy": true,
        "DefaultWorkingDirectory/ctt/ctt.exe": true
    },
    "exec": {
        "DefaultWorkingDirectory/ctt/ctt.exe s:C:\\tempFolder\\web.config t:C:\\tempFolder\\web.Release.config d:C:\\tempFolder\\web.config pw i verbose": {
            "code": 0,
            "stdout": "ctt execution successful"
        },
        "msdeploy -verb:sync -source:package=\'DefaultWorkingDirectory\\temp_web_package.zip\' -dest:auto -setParam:name=\'IIS Web Application Name\',value=\'mytestwebsite\' -enableRule:DoNotDeleteRule": {
            "code": 0,
            "stdout": "Executed Successfully"
        }
    },
    "rmRF": {
        "temp_web_package_random_path": {
            "success": true
        },
        "DefaultWorkingDirectory\temp_web_package.zip": {
            "success": true
        }
    },
    "exist": {
    	"webAppPkg.zip": true,
        "webAppPkg": true
    }, 
    "findMatch": {
        "webAppPkgPattern" : ["webAppPkg1", "webAppPkg2"],
        "Invalid_webAppPkg" : [],
        "webAppPkg.zip": ["webAppPkg.zip"],
        "webAppPkg": ["webAppPkg"],
        "**/*.config": ["C:\\tempFolder\\web.config", "C:\\tempFolder\\web.Release.config", "C:\\tempFolder\\web.Debug.config"]
    },
    "getVariable": {
    	"ENDPOINT_AUTH_AzureRMSpn": "{\"parameters\":{\"serviceprincipalid\":\"spId\",\"serviceprincipalkey\":\"spKey\",\"tenantid\":\"tenant\"},\"scheme\":\"ServicePrincipal\"}",
   		"ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONNAME": "sName", 
    	"ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONID": "sId",
    	"AZURE_HTTP_USER_AGENT": "TFS_useragent",
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

import mockTask = require('azure-pipelines-task-lib/mock-task');

var msDeployUtility = require('azure-pipelines-tasks-webdeployment-common/msdeployutility.js'); 

tr.registerMock('./msdeployutility.js', {
    getMSDeployCmdArgs : msDeployUtility.getMSDeployCmdArgs,
    getMSDeployFullPath : function() {
        var msDeployFullPath =  "msdeploypath\\msdeploy.exe";
        return msDeployFullPath;
    }
}); 

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

tr.registerMock('azure-pipelines-tasks-webdeployment-common/utility.js', {
    isInputPkgIsFolder: function() {
        return false;    
    },
    fileExists: function() {
        return true;   
    },
    canUseWebDeploy: function() {
        return true;
    },
    findfiles: function() {
        return ['webDeployPkg']    
    },
    generateTemporaryFolderForDeployment: function() {
        return 'temp_web_package_random_path';
    },
    archiveFolderForDeployment: function() {
        return {
            "webDeployPkg": "DefaultWorkingDirectory\\temp_web_package.zip",
            "tempPackagePath": "DefaultWorkingDirectory\\temp_web_package.zip"
        };
    },
    isMSDeployPackage: function() {
        return false;
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

tr.registerMock('path', {
    win32: {
        basename: function(filePath, extension) {
            return path.win32.basename(filePath, extension);
        }
    },
    join: function() {
        if(arguments[arguments.length -1] === 'ctt.exe') {
            return 'DefaultWorkingDirectory/ctt/ctt.exe';
        }
        var args = [];
        for(var i=0; i < arguments.length; i += 1) {
            args.push(arguments[i]);
        }
        return args.join('\\');
    },
    dirname: path.dirname
});

tr.setAnswers(a);
tr.run();