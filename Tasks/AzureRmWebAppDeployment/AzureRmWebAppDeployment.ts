
/// <reference path="../../definitions/node.d.ts" />
/// <reference path="../../definitions/q.d.ts" />

var tl = require('vsts-task-lib/task');
var azureRmUtil = require ('./AzureRMUtil.js');
var Utility = require('./MSDeployUtility.js');

var ConnectedServiceName = tl.getInput('ConnectedServiceName');
var WebAppName: string = tl.getInput('WebAppName');
var DeployToSlotFlag: boolean = tl.getBoolInput('DeployToSlotFlag');
var ResourceGroupName: string = tl.getInput('ResourceGroupName');
var SlotName: string = tl.getInput('SlotName');
var Package: string = tl.getPathInput('Package');
var SetParametersFile: string = tl.getInput('SetParametersFile');
var RemoveAdditionalFilesFlag: boolean = tl.getBoolInput('RemoveAdditionalFilesFlag');
var ExcludeFilesFromAppDataFlag: boolean = tl.getBoolInput('ExcludeFilesFromAppDataFlag');
var TakeAppOfflineFlag: boolean = tl.getBoolInput('TakeAppOfflineFlag');
var VirtualApplication: string = tl.getInput('VirtualApplication');
var AdditionalArguments: string = tl.getInput('AdditionalArguments');
var WebAppUri:string = tl.getInput('WebAppUri');
var settings: boolean = true; /* Check for Windows settings */
var PublishMethod: string = tl.getInput('PublishMethod');

//Error Handler
var onError = function(errorMsg) {
	tl.error(errorMsg);
	process.exit(1);
}

if(PublishMethod == "WebDeploy" || PublishMethod != "FTP") {
	PublishMethod = "MSDeploy";
}

var endPointAuthCreds = tl.getEndpointAuthorization(ConnectedServiceName, false);

var SPN = new Array();
SPN["servicePrincipalClientID"] = endPointAuthCreds.parameters.serviceprincipalid;
SPN["servicePrincipalKey"] = endPointAuthCreds.parameters.serviceprincipalkey;
SPN["tenantID"] = endPointAuthCreds.parameters.tenantid;
SPN["subscriptionId"] = tl.getEndpointDataParameter (ConnectedServiceName, 'subscriptionid',true); 
 
if(Utility.isFileExists(Package)) {
	tl.debug("Package "+Package+" is found in the machine");
}

if(!Utility.isFileExists(SetParametersFile)) {
	SetParametersFile = null;
}

azureRmUtil.getAzureRMWebAppPublishingProfileDetails(SPN, WebAppName, ResourceGroupName, PublishMethod, DeployToSlotFlag, SlotName).then(function (publishingProfile) {
	var azureRMWebAppConnectionDetails = new Array();
	azureRMWebAppConnectionDetails["KuduHostName"] = publishingProfile.publishUrl;
	azureRMWebAppConnectionDetails["UserName"] = publishingProfile.userName;
	azureRMWebAppConnectionDetails["UserPassword"] = publishingProfile.userPWD;
	WebAppName = Utility.getWebAppNameForMSDeployCmd(WebAppName, DeployToSlotFlag, SlotName);
	Utility.runMSDeployCommandWrapper(Utility.getMSDeployCmdArgs(Package, WebAppName, azureRMWebAppConnectionDetails, RemoveAdditionalFilesFlag, ExcludeFilesFromAppDataFlag, TakeAppOfflineFlag, VirtualApplication, SetParametersFile, AdditionalArguments), azureRMWebAppConnectionDetails);
},function (error) {
	onError(error);
});
