import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'azurermwebappdeployment.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
tr.setInput('ConnectedServiceName', 'AzureRMSpn');
tr.setInput('WebAppName', 'mytestapp');
tr.setInput('Package', 'webAppPkg.zip');
tr.setInput('UseWebDeploy', 'true');
tr.setInput('JSONFiles', 'testfile.json');

process.env['TASK_TEST_TRACE'] = 1;
process.env["ENDPOINT_AUTH_AzureRMSpn"] = "{\"parameters\":{\"serviceprincipalid\":\"spId\",\"serviceprincipalkey\":\"spKey\",\"tenantid\":\"tenant\"},\"scheme\":\"ServicePrincipal\"}";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONNAME"] = "sName";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONID"] =  "sId";
process.env["AZURE_HTTP_USER_AGENT"] = "TFS_useragent";
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
    "rmRF": {
        "DefaultWorkingDirectory\\msDeployCommand.bat": {
            "success": true
        }
    },
    "exec": {
        "cmd /C DefaultWorkingDirectory\\msDeployCommand.bat": {
            "code": 0,
            "stdout": "Executed Successfully"
        },
        "cmd /C DefaultWorkingDirectory\\msDeployParam.bat": {
            "code": 0,
            "stdout": "Executed Successfully"
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
        "webAppPkg": ["webAppPkg"]
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
}

import mockTask = require('vsts-task-lib/mock-task');
var kuduDeploymentLog = require('azurerest-common/kududeploymentstatusutility.js');
var msDeployUtility = require('webdeployment-common/msdeployutility.js');
var jsonSubUtil = require('webdeployment-common/jsonvariablesubstitutionutility.js');

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

tr.registerMock('azurerest-common/azurerestutility.js', {
    getAzureRMWebAppPublishProfile: function(SPN, webAppName, resourceGroupName, deployToSlotFlag, slotName) {
        var mockPublishProfile = {
            profileName: 'mytestapp - Web Deploy',
            publishMethod: 'MSDeploy',
            publishUrl: 'mytestappKuduUrl',
            msdeploySite: 'mytestapp',
            userName: '$mytestapp',
            userPWD: 'mytestappPwd',
            destinationAppUrl: 'mytestappUrl',
            SQLServerDBConnectionString: '',
            mySQLDBConnectionString: '',
            hostingProviderForumLink: '',
            controlPanelLink: '',
            webSystem: 'WebSites' 
        };
        if(deployToSlotFlag) {
            mockPublishProfile.profileName =  'mytestapp-' + slotName + ' - Web Deploy';
            mockPublishProfile.publishUrl = 'mytestappKuduUrl-' + slotName;
            mockPublishProfile.msdeploySite = 'mytestapp__' + slotName;
            mockPublishProfile.userName = '$mytestapp__' + slotName;
            mockPublishProfile.userPWD = 'mytestappPwd';
            mockPublishProfile.destinationAppUrl = 'mytestappUrl-' + slotName;
        }
        return mockPublishProfile;
    },
    getAzureRMWebAppConfigDetails: function(SPN, webAppName, resourceGroupName, deployToSlotFlag, slotName) {
	var config = { 
			id: 'appid',
			properties: { 
				virtualApplications: [ ['Object'], ['Object'], ['Object'] ],
			} 
		}

		return config;
	},
    updateDeploymentStatus: function(publishingProfile, isDeploymentSuccess ) {
        if(isDeploymentSuccess) {
            console.log('Updated history to kudu');
        }
        else {
            console.log('Failed to update history to kudu');
        }
        var webAppPublishKuduUrl = publishingProfile.publishUrl;
        var requestDetails = kuduDeploymentLog.getUpdateHistoryRequest(webAppPublishKuduUrl, isDeploymentSuccess);
        requestDetails["requestBody"].author = 'author';
        console.log("kudu log requestBody is:" + JSON.stringify(requestDetails["requestBody"]));
    },
    getResourceGroupName: function (SPN, webAppName) {
        return "foobar";
    },
    getWebAppAppSettings : function (SPN, webAppName: string, resourceGroupName: string, deployToSlotFlag: boolean, slotName: string){
        var appSettings = {
            properties : {
                MSDEPLOY_RENAME_LOCKED_FILES : '1'
            }
        };
        return appSettings;
    },
    updateWebAppAppSettings : function (){
        return true;
    }
});

tr.registerMock('webdeployment-common/ziputility.js', {
    'unzip': function(zipLocation, unzipLocation) {
        console.log('Extracting ' + zipLocation + ' to ' + unzipLocation);
    },
    archiveFolder: function(folderPath, targetPath, zipName) {
        console.log('Archiving ' + folderPath + ' to ' + targetPath + '/' + zipName);
    }
});

tr.registerMock('webdeployment-common/jsonvariablesubstitutionutility.js', {
    jsonVariableSubstitution: function(absolutePath, jsonSubFiles) {
        var envVarObject = jsonSubUtil.createEnvTree([
            { name: 'system.debug', value: 'true', secret: false},
            { name: 'data.ConnectionString', value: 'database_connection', secret: false},
            { name: 'data.userName', value: 'db_admin', secret: false},
            { name: 'data.password', value: 'db_pass', secret: true},
            { name: '&pl.ch@r@cter.k^y', value: '*.config', secret: false},
            { name: 'build.sourceDirectory', value: 'DefaultWorkingDirectory', secret: false},
            { name: 'user.profile.name.first', value: 'firstName', secret: false},
            { name: 'user.profile', value: 'replace_all', secret: false}
        ]);
        var jsonObject = {
            'User.Profile': 'do_not_replace',
            'data': {
                'ConnectionString' : 'connect_string',
                'userName': 'name',
                'password': 'pass'
            },
            '&pl': {
                'ch@r@cter.k^y': 'v@lue'
            },
            'system': {
                'debug' : 'no_change'
            },
            'user.profile': {
                'name.first' : 'fname'
            }
        }
        // Method to be checked for JSON variable substitution
        jsonSubUtil.substituteJsonVariable(jsonObject, envVarObject);

        if(typeof jsonObject['user.profile'] === 'object') {
            console.log('JSON - eliminating object variables validated');
        }
        if(jsonObject['data']['ConnectionString'] === 'database_connection' && jsonObject['data']['userName'] === 'db_admin') {
            console.log('JSON - simple string change validated');
        }
        if(jsonObject['system']['debug'] === 'no_change') {
            console.log('JSON - system variable elimination validated');
        }
        if(jsonObject['&pl']['ch@r@cter.k^y'] === '*.config') {
            console.log('JSON - special variables validated');
        }
        if(jsonObject['user.profile']['name.first'] === 'firstName') {
            console.log('JSON - varaibles with dot character validated');
        }
        if(jsonObject['User.Profile'] === 'do_not_replace') {
            console.log('JSON - case sensitive variables validated');
        }
    }
});

tr.setAnswers(a);
tr.run();