function getAzureRMWebAppPublishProfile(SPN, webAppName, resourceGroupName, deployToSlotFlag, slotName) {
	
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

}
exports.getAzureRMWebAppPublishProfile = getAzureRMWebAppPublishProfile;

function updateDeploymentStatus(publishingProfile, isDeploymentSuccess ) {
	if(isDeploymentSuccess) {
		console.log('Updated history');
	}
	else {
		console.log('Failed Updation');
	}
}
exports.updateDeploymentStatus = updateDeploymentStatus;