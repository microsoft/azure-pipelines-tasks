
/// <reference path="../../definitions/node.d.ts" />
/// <reference path="../../definitions/q.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />

var tl = require('vsts-task-lib/task');
var fs = require('fs');
var azureRmUtil = require ('./AzureRMUtil.js');
var msDeployUtility = require('./MSDeployUtility.js');
var path = require('path');

async function run() {
	try {

		tl.setResourcePath(path.join( __dirname, 'task.json'));
		var connectedServiceName = tl.getInput('ConnectedServiceName');
		var webAppName: string = tl.getInput('WebAppName');
		var deployToSlotFlag: boolean = tl.getBoolInput('DeployToSlotFlag');
		var resourceGroupName: string = tl.getInput('ResourceGroupName');
		var slotName: string = tl.getInput('SlotName');
		var package: string = tl.getPathInput('Package');
		var setParametersFile: string = tl.getPathInput('SetParametersFile');
		var removeAdditionalFilesFlag: boolean = tl.getBoolInput('RemoveAdditionalFilesFlag');
		var excludeFilesFromAppDataFlag: boolean = tl.getBoolInput('ExcludeFilesFromAppDataFlag');
		var takeAppOfflineFlag: boolean = tl.getBoolInput('TakeAppOfflineFlag');
		var virtualApplication: string = tl.getInput('VirtualApplication');
		var additionalArguments: string = tl.getInput('AdditionalArguments');
		var webAppUri:string = tl.getInput('WebAppUri');
		var useWebDeploy: boolean = tl.getBoolInput('UseWebDeploy');
		var endPointAuthCreds = tl.getEndpointAuthorization(connectedServiceName, true);

		var SPN = new Array();
		SPN["servicePrincipalClientID"] = endPointAuthCreds.parameters.serviceprincipalid;
		SPN["servicePrincipalKey"] = endPointAuthCreds.parameters.serviceprincipalkey;
		SPN["tenantID"] = endPointAuthCreds.parameters.tenantid;
		SPN["subscriptionId"] = tl.getEndpointDataParameter (connectedServiceName, 'subscriptionid', true); 
		
		if (fs.statSync(package).isFile()) {
			tl.debug(tl.loc('Packagefound0', package));
		}

		if ( !fs.statSync(setParametersFile).isFile()) {
			setParametersFile = null;
		}

		var publishingProfile = await azureRmUtil.getAzureRMWebAppPublishProfile(SPN, webAppName, resourceGroupName, deployToSlotFlag, slotName);
		var azureRMWebAppConnectionDetails = new Array();
		azureRMWebAppConnectionDetails["KuduHostName"] = publishingProfile.publishUrl;
		azureRMWebAppConnectionDetails["UserName"] = publishingProfile.userName;
		azureRMWebAppConnectionDetails["UserPassword"] = publishingProfile.userPWD;
		webAppName = deployToSlotFlag ?  webAppName + "(" + slotName + ")" : webAppName;

		var msDeployArgs = msDeployUtility.getMSDeployCmdArgs(package, webAppName, azureRMWebAppConnectionDetails, removeAdditionalFilesFlag,
						 excludeFilesFromAppDataFlag, takeAppOfflineFlag, virtualApplication, setParametersFile, additionalArguments);
		msDeployUtility.executeMSDeployCmd(msDeployArgs, azureRMWebAppConnectionDetails);
	} catch (error) {
		tl.setResult(tl.TaskResult.Failed, error);
	}
}

run();