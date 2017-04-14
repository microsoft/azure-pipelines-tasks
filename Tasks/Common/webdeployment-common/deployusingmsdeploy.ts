import tl = require('vsts-task-lib/task');
import fs = require('fs');
import path = require('path');
import Q = require('q');

var msDeployUtility = require('./msdeployutility.js');
var utility = require('./utility.js');

const DEFAULT_RETRY_COUNT = 3;

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

    var msDeployPath = await msDeployUtility.getMSDeployFullPath();
    var msDeployDirectory = msDeployPath.slice(0, msDeployPath.lastIndexOf('\\') + 1);
    var pathVar = process.env.PATH;
    process.env.PATH = msDeployDirectory + ";" + process.env.PATH ;

    setParametersFile = utility.copySetParamFileIfItExists(setParametersFile);
    var setParametersFileName = null;

    if(setParametersFile != null) {
        setParametersFileName = setParametersFile.slice(setParametersFile.lastIndexOf('\\') + 1, setParametersFile.length);
    }
    var isParamFilePresentInPackage = isFolderBasedDeployment ? false : await utility.isMSDeployPackage(webDeployPkg);

    var msDeployCmdArgs = msDeployUtility.getMSDeployCmdArgs(webDeployPkg, webAppName, publishingProfile, removeAdditionalFilesFlag,
        excludeFilesFromAppDataFlag, takeAppOfflineFlag, virtualApplication, setParametersFileName, additionalArguments, isParamFilePresentInPackage, isFolderBasedDeployment,
        useWebDeploy);

    var retryCountParam = tl.getVariable("appservice.msdeployretrycount");
    var retryCount = (retryCountParam && !(isNaN(Number(retryCountParam)))) ? Number(retryCountParam): DEFAULT_RETRY_COUNT; 
    
    try {
        var shouldContinue = true;
        while(shouldContinue) {
            try {
                 await executeMSDeploy(msDeployCmdArgs);
                 shouldContinue = false;
            } catch (error) {
                shouldContinue = (msDeployUtility.shouldRetryMSDeploy() && retryCount-- > 0);
                if(!shouldContinue) {
                    throw error;
                } else {
                    console.log("Retrying to deploy app service.");
                }
            }
        }
        if(publishingProfile != null) {
            console.log(tl.loc('PackageDeploymentSuccess'));
        }
    }
    catch (error) {
        tl.error(tl.loc('PackageDeploymentFailed'));
        tl.debug(JSON.stringify(error));
        msDeployUtility.redirectMSDeployErrorToConsole();
        throw Error(error.message);
    }
    finally {
        process.env.PATH = pathVar;
        if(setParametersFile != null) {
            tl.rmRF(setParametersFile, true);
        }
    }
}

async function executeMSDeploy(msDeployCmdArgs) {
    var deferred = Q.defer();

    var msDeployError = null;
    var errorFile = path.join(tl.getVariable('System.DefaultWorkingDirectory'),"error.txt");
    var fd = fs.openSync(errorFile, "w");
    var errObj = fs.createWriteStream("", {fd: fd} );

    errObj.on('finish', async () => {
        if(msDeployError) {
           deferred.reject(msDeployError);
        }
    });

    try {
        await tl.exec("msdeploy", msDeployCmdArgs, <any>{failOnStdErr: true, errStream: errObj});
        deferred.resolve("Azure App service successfully deployed");
    } catch (error) {
        msDeployError = error;
    } finally {
        errObj.end();
    }
    return deferred.promise;
}
