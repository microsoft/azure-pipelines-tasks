import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require('fs');

var msDeploy = require('webdeployment-common/deployusingmsdeploy.js');
var utility = require('webdeployment-common/utility.js');
var zipUtility = require('webdeployment-common/ziputility.js');
var jsonSubstitutionUtility = require('webdeployment-common/jsonvariablesubstitutionutility.js');
var xmlSubstitutionUtility = require('webdeployment-common/xmlvariablesubstitutionutility.js');
var xdtTransformationUtility = require('webdeployment-common/xdttransformationutility.js');

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
        var xmlTransformation: boolean = tl.getBoolInput('XmlTransformation', false);
        var JSONFiles: string[] = tl.getDelimitedInput('JSONFiles', '\n', false);
        var xmlVariableSubstitution: boolean = tl.getBoolInput('XmlVariableSubstitution', false);
		

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

        if(JSONFiles.length != 0 || xmlTransformation || xmlVariableSubstitution) {

            var folderPath = path.join(tl.getVariable('System.DefaultWorkingDirectory'), 'temp_web_package_folder');
            if(isFolderBasedDeployment) {
                tl.cp(path.join(webDeployPkg, '/*'), folderPath, '-rf', false);
            }
            else {
                await zipUtility.unzip(webDeployPkg, folderPath);
            }

            if(xmlTransformation) {
                var environmentName = tl.getVariable('Release.EnvironmentName');
                if(tl.osType().match(/^Win/)) {
                    var transformConfigs = ["Release.config"];
                    if(environmentName) {
                        transformConfigs.push(environmentName + ".config");
                    }
                    xdtTransformationUtility.basicXdtTransformation(path.join(folderPath,'**', '*.config'), transformConfigs);  
                    tl._writeLine("XDT Transformations applied successfully");
                } else {
                    throw new Error(tl.loc("CannotPerformXdtTransformationOnNonWindowsPlatform"));
                }
            }

            if(xmlVariableSubstitution) {
                await xmlSubstitutionUtility.substituteAppSettingsVariables(folderPath);
            }

            if(JSONFiles.length != 0) {
                jsonSubstitutionUtility.jsonVariableSubstitution(folderPath, JSONFiles);
            }

            webDeployPkg = (isFolderBasedDeployment) ? folderPath : await zipUtility.archiveFolder(folderPath, tl.getVariable('System.DefaultWorkingDirectory'), 'temp_web_package.zip')
        }

		
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