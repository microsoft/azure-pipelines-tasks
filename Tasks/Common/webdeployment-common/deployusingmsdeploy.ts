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
	var tempSetParamFile = null;
	var setParametersFileName = null;
	var pathVar;
	if(setParametersFile != null)
	{
		tempSetParamFile = path.join(tl.getVariable('System.DefaultWorkingDirectory'), "tempSetParameters.xml");
		tl.cp(setParametersFile, tempSetParamFile);
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

        //var msDeployBatchFile = tl.getVariable('System.DefaultWorkingDirectory') + '\\' + 'msDeployCommand.bat';
        //var msDeployCommand = '@echo off \n';
        //msDeployCommand += '"' + msDeployPath + '" ' + msDeployCmdArgs + ' 2>error.txt\n';
        //msDeployCommand += 'if %errorlevel% neq 0 exit /b %errorlevel%';
        //tl.writeFile(msDeployBatchFile, msDeployCommand);
        //tl._writeLine(tl.loc("Runningcommand", msDeployCommand));
        //await tl.exec("cmd", ['/C', msDeployBatchFile], <any> {failOnStdErr: true});
        //tl.rmRF(msDeployBatchFile, true);
        if(publishingProfile != null){
        tl._writeLine(tl.loc('WebappsuccessfullypublishedatUrl0', publishingProfile.destinationAppUrl));}
    }
    catch(error) {
        tl.error(tl.loc('Failedtodeploywebsite'));
        msDeployUtility.redirectMSDeployErrorToConsole();
        throw Error(error);
    }
	finally{
		process.env.PATH = pathVar;
		if(tempSetParamFile != null){
			if(tl.exist(tempSetParamFile)){
				tl.rmRF(tempSetParamFile, true);
			}
		}
	}
}