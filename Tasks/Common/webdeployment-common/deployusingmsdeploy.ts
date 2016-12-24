import tl = require('vsts-task-lib/task');
import fs = require('fs');
import path = require('path');

var msDeployUtility = require('./msdeployutility.js');
var utility = require('./utility.js');

/**
 * Executes Web Deploy command
 * 
 * @param   webDeployPkg                   Web deploy package
 * @param   webAppName                      web App Name
 * @param   publishingProfile               Azure RM Connection Details
 * @param   removeAdditionalFilesFlag       Flag to set DoNotDeleteRule rule
 * @param   excludeFilesFromAppDataFlag     Flag to prevent App Data from publishing
 * @param   takeAppOfflineFlag              Flag to enable AppOffline rule
 * @param   virtualApplication              Virtual Application Name
 * @param   setParametersFile               Set Parameter File path
 * @param   additionalArguments             Arguments provided by user
 * 
 */
export async function DeployUsingMSDeploy(webDeployPkg, webAppName, publishingProfile, removeAdditionalFilesFlag, 
        excludeFilesFromAppDataFlag, takeAppOfflineFlag, virtualApplication, setParametersFile, additionalArguments, isFolderBasedDeployment, useWebDeploy) {

    setParametersFile = utility.getSetParamFilePath(setParametersFile);
	var msDeployCmdArgs;
	var setParametersFileName = null;
	var pathVar;
	if(setParametersFile != null) {
		setParametersFileName = "tempSetParameters.xml";
	}
    var isParamFilePresentInPackage = isFolderBasedDeployment ? false : await msDeployUtility.containsParamFile(webDeployPkg);
    var msDeployPath = await msDeployUtility.getMSDeployFullPath();
    msDeployCmdArgs = msDeployUtility.getMSDeployCmdArgs(webDeployPkg, webAppName, publishingProfile, removeAdditionalFilesFlag,
        excludeFilesFromAppDataFlag, takeAppOfflineFlag, virtualApplication, setParametersFileName, additionalArguments, isParamFilePresentInPackage, isFolderBasedDeployment, 
        useWebDeploy);

    try {
		var msDeployDirectory = msDeployPath.slice(0, msDeployPath.lastIndexOf('\\') + 1);
		pathVar = process.env.PATH;
        process.env.PATH = msDeployDirectory + ";" + process.env.PATH ;
		
        var errorFile = path.join(tl.getVariable('System.DefaultWorkingDirectory'),"error.txt");
        var errObj = fs.createWriteStream(errorFile);
		await tl.exec("msdeploy", msDeployCmdArgs, <any>{failOnStdErr: true, errStream: errObj});

        if(publishingProfile != null) {
            tl._writeLine(tl.loc('WebappsuccessfullypublishedatUrl0', publishingProfile.destinationAppUrl));
	    }
    }
    catch(error) {
        process.env.PATH = pathVar;
        tl.error(tl.loc('Failedtodeploywebsite'));
        msDeployUtility.redirectMSDeployErrorToConsole();
        throw Error(error);
    }
	finally {
		process.env.PATH = pathVar;
		if(setParametersFile != null) {
			if(tl.exist(setParametersFile)) {
				tl.rmRF(setParametersFile, true);
			}
		}
	}
}