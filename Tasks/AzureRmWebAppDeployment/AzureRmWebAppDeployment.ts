
/// <reference path="../../definitions/node.d.ts" />
/// <reference path="../../definitions/q.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import tl = require('vsts-task-lib/task');
import path = require('path');

var azureRmUtil = require ('./AzureRMUtil.js');
var msDeployUtility = require('./MSDeployUtility.js');

async function run() {
	try {

		tl.setResourcePath(path.join( __dirname, 'task.json'));
		var connectedServiceName = tl.getInput('ConnectedServiceName');
		var webAppName: string = tl.getInput('WebAppName');
		var deployToSlotFlag: boolean = tl.getBoolInput('DeployToSlotFlag');
		var resourceGroupName: string = tl.getInput('ResourceGroupName');
		var slotName: string = tl.getInput('SlotName');
		var webDeployPkg: string = trimDoubleQuotes(tl.getPathInput('Package'));
		var setParametersFile: string = trimDoubleQuotes(tl.getPathInput('SetParametersFile'));
		var removeAdditionalFilesFlag: boolean = tl.getBoolInput('RemoveAdditionalFilesFlag');
		var excludeFilesFromAppDataFlag: boolean = tl.getBoolInput('ExcludeFilesFromAppDataFlag');
		var takeAppOfflineFlag: boolean = tl.getBoolInput('TakeAppOfflineFlag');
		var virtualApplication: string = tl.getInput('VirtualApplication');
		var additionalArguments: string = tl.getInput('AdditionalArguments');
		var webAppUri:string = tl.getInput('WebAppUri');
		var useWebDeploy: boolean = tl.getBoolInput('UseWebDeploy');
		var endPointAuthCreds = tl.getEndpointAuthorization(connectedServiceName, true);

		var SPN = new Array();
		SPN["servicePrincipalClientID"] = endPointAuthCreds.parameters["serviceprincipalid"];
		SPN["servicePrincipalKey"] = endPointAuthCreds.parameters["serviceprincipalkey"];
		SPN["tenantID"] = endPointAuthCreds.parameters["tenantid"];
		SPN["subscriptionId"] = tl.getEndpointDataParameter (connectedServiceName, 'subscriptionid', true); 
		
		if (!msDeployUtility.fileExists(webDeployPkg)) {
			throw new Error(tl.loc('Packagenotfound0', webDeployPkg));			
		}

		var systemDefaultWorkingDir = tl.getVariable('SYSTEM_DEFAULTWORKINGDIRECTORY');
		if(setParametersFile === systemDefaultWorkingDir || setParametersFile === systemDefaultWorkingDir + '\\' || setParametersFile === "") {
			setParametersFile = null;
		}
		else if (!msDeployUtility.fileExists(setParametersFile)) {
			throw new Error(tl.loc('SetParamFilenotfound0', setParametersFile));
		}
		
		
		var publishingProfile = await azureRmUtil.getAzureRMWebAppPublishProfile(SPN, webAppName, resourceGroupName, deployToSlotFlag, slotName);
		var azureRMWebAppConnectionDetails = new Array();
		azureRMWebAppConnectionDetails["KuduHostName"] = publishingProfile.publishUrl;
		azureRMWebAppConnectionDetails["UserName"] = publishingProfile.userName;
		azureRMWebAppConnectionDetails["UserPassword"] = publishingProfile.userPWD;
		webAppName = deployToSlotFlag ?  webAppName + "(" + slotName + ")" : webAppName;

		var msDeployArgs = msDeployUtility.getMSDeployCmdArgs(webDeployPkg, webAppName, azureRMWebAppConnectionDetails, removeAdditionalFilesFlag,
						 excludeFilesFromAppDataFlag, takeAppOfflineFlag, virtualApplication, setParametersFile, additionalArguments);
		msDeployUtility.executeMSDeployCmd(msDeployArgs, azureRMWebAppConnectionDetails);
	} catch (error) {
		tl.setResult(tl.TaskResult.Failed, error);
	}
}

function trimDoubleQuotes(input: string): string {

	if (input.charAt(0) === '"' && input.charAt(input.length -1) === '"')
	{
    	 input = input.substr(1, input.length -2);
	}

	return input;
}

run();