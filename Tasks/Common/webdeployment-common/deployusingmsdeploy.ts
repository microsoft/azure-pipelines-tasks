import tl = require('vsts-task-lib/task');
import fs = require('fs');
import path = require('path');

var msDeployUtility = require('./msdeployutility.js');
var utility = require('./utility.js');
var azureRESTUtility = require ('./azurerestutility.js'); // should be removed

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

	setParametersFile = utility.copySetParamFileIfItExists(setParametersFile);
    var msDeployPath = await msDeployUtility.getMSDeployFullPath();
    var msDeployDirectory = msDeployPath.slice(0, msDeployPath.lastIndexOf('\\') + 1);
    var pathVar = process.env.PATH;
    process.env.PATH = msDeployDirectory + ";" + process.env.PATH;

    setParametersFile = utility.copySetParamFileIfItExists(setParametersFile);
    var setParametersFileName = null;

    if(setParametersFile != null) {
        setParametersFileName = setParametersFile.slice(setParametersFile.lastIndexOf('\\' + 1), setParametersFile.length);
    }
	var isParamFilePresentInPackage = isFolderBasedDeployment ? false : await msDeployUtility.containsParamFile(webDeployPkg);
    var msDeployPath = await msDeployUtility.getMSDeployFullPath();
    var msDeployCmdArgs = msDeployUtility.getMSDeployCmdArgs(webDeployPkg, webAppName, publishingProfile, removeAdditionalFilesFlag,
        excludeFilesFromAppDataFlag, takeAppOfflineFlag, virtualApplication, setParametersFileName, additionalArguments, isParamFilePresentInPackage, isFolderBasedDeployment, 
        useWebDeploy);

    var isDeploymentSuccess = true;
    var deploymentError = null;

    var errorFile = path.join(tl.getVariable('System.DefaultWorkingDirectory'), "error.txt");
    var fd = fs.openSync(errorFile, "w");
    var isErrorFileOpen = true;
    var errObj = fs.createWriteStream("", {fd: fd});

    try {
        await tl.exec("msdeploy", msDeployCmdArgs, <any>{failOnStdErr: true, errStream: errObj})

        /*var msDeployBatchFile = tl.getVariable('System.DefaultWorkingDirectory') + '\\' + 'msDeployCommand.bat';
        var msDeployCommand = '@echo off \n';
        msDeployCommand += '"' + msDeployPath + '" ' + msDeployCmdArgs + ' 2>error.txt\n';
        msDeployCommand += 'if %errorlevel% neq 0 exit /b %errorlevel%';
        tl.writeFile(msDeployBatchFile, msDeployCommand);
        tl._writeLine(tl.loc("Runningcommand", msDeployCommand));
        await tl.exec("cmd", ['/C', msDeployBatchFile], <any> {failOnStdErr: true});
        tl.rmRF(msDeployBatchFile, true);*/
		if(publishingProfile != null){
        tl._writeLine(tl.loc('WebappsuccessfullypublishedatUrl0', publishingProfile.destinationAppUrl));}
    }
    catch (error) {
        fs.fsyncSync(fd);
        fs.closeSync(fd);
        isErrorFileOpen = false;
        tl.error(tl.loc('Failedtodeploywebsite'));
        isDeploymentSuccess = false;
        deploymentError = error;
        msDeployUtility.redirectMSDeployErrorToConsole();
    }
    finally {
        if(isErrorFileOpen) {
            fs.fsyncSync(fd);
            fs.closeSync(fd);
            isErrorFileOpen = false;
        }
        process.env.PATH = pathVar;
        if(setParametersFile != null) {
            tl.rmRF(setParametersFile, true);
        }

        if(publishingProfile != null){
            try {
                tl._writeLine(await azureRESTUtility.updateDeploymentStatus(publishingProfile, isDeploymentSuccess));
            }
            catch(error) {
                tl.warning(error);
            }
        }

        if(!isDeploymentSuccess) {
            throw Error(deploymentError);
        }
    }
}