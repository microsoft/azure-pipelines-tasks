import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'azurewebappslotswap.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
tr.setInput('ConnectedServiceName', 'AzureRMSpn');
tr.setInput('WebAppName', 'mytestapp');
tr.setInput('ResourceGroupName', 'myresourcegroup');
tr.setInput('SourceSlot', 'slot1');
tr.setInput('TargetSlot', 'slot1');

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
process.env["AGENT_NAME"] = "agent";

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers> {
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

var kuduDeploymentLog = require('../kududeploymentlog.js');

tr.registerMock('webdeployment-common/azurerestutility.js', {
    getAzureRMWebAppPublishProfile: function(SPN, resourceGroupName, webAppName, slotName) {
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
        if(slotName != "production") {
            mockPublishProfile.profileName =  'mytestapp-' + slotName + ' - Web Deploy';
            mockPublishProfile.publishUrl = 'mytestappKuduUrl-' + slotName;
            mockPublishProfile.msdeploySite = 'mytestapp__' + slotName;
            mockPublishProfile.userName = '$mytestapp__' + slotName;
            mockPublishProfile.userPWD = 'mytestappPwd';
            mockPublishProfile.destinationAppUrl = 'mytestappUrl-' + slotName;
        }
        return mockPublishProfile;
    }
});

tr.registerMock('./azurermutil.js', {
    getAuthorizationToken: function(SPN) {
        return {};
    },
    swapWebAppSlot: function(SPN, accessToken, resourceGroupName, webAppName, sourceSlot, targetSlot, preserveVnet) {
        console.log('Successfully swapped web app slots');
    },
    updateSlotSwapStatus: function(publishingProfile, deploymentId, isSlotSwapSuccess, sourceSlot, targetSlot) {
        var webAppPublishKuduUrl = publishingProfile.publishUrl;
        var requestDetails = kuduDeploymentLog.getUpdateHistoryRequest(webAppPublishKuduUrl, deploymentId, isSlotSwapSuccess, sourceSlot, targetSlot);
        console.log('kudu log request body is:' + JSON.stringify(requestDetails["requestBody"]));
        if(isSlotSwapSuccess) {
            console.log("Updated slot swap history to kudu with status as successful");
        }
        else {
            console.log("Updated slot swap history to kudu with status as failed");
        }
    }
});

tr.setAnswers(a);
tr.run();