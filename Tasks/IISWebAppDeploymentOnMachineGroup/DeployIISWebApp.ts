import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require('fs');

var msDeploy = require('webdeployment-common/deployusingmsdeploy.js');
var utility = require('webdeployment-common/utility.js');

async function run()
{
	try
	{
		tl.setResourcePath(path.join( __dirname, 'task.json'));
		var webSiteName: string = tl.getInput('WebSiteName', true);
		var virtualApplication: string = tl.getInput('VirtualApplication', false);
		var webDeployPkg: string = tl.getPathInput('Package', true);
		var setParametersFile: string = tl.getPathInput('SetParametersFile', false);
		var removeAdditionalFilesFlag: boolean = tl.getBoolInput('RemoveAdditionalFilesFlag', false);
		var excludeFilesFromAppDataFlag: boolean = tl.getBoolInput('ExcludeFilesFromAppDataFlag', false);
		var takeAppOfflineFlag: boolean = tl.getBoolInput('TakeAppOfflineFlag', false);
		var additionalArguments: string = tl.getInput('AdditionalArguments', false);
		var availableWebPackages = tl.glob(webDeployPkg);

		if(availableWebPackages.length == 0)
		{
			throw new Error(tl.loc('Nopackagefoundwithspecifiedpattern'));
		}

		if(availableWebPackages.length > 1)
		{
			throw new Error(tl.loc('MorethanonepackagematchedwithspecifiedpatternPleaserestrainthesearchpatern'));
		}
		webDeployPkg = availableWebPackages[0];

		var isFolderBasedDeployment = await utility.isInputPkgIsFolder(webDeployPkg);
		
		await msDeploy.DeployUsingMSDeploy(webDeployPkg, webSiteName, null, removeAdditionalFilesFlag,
                        excludeFilesFromAppDataFlag, takeAppOfflineFlag, virtualApplication, setParametersFile,
                        additionalArguments, isFolderBasedDeployment, true);
        
	}
	catch(error)
	{
		tl.setResult(tl.TaskResult.Failed,error);
	}
	
}
run();