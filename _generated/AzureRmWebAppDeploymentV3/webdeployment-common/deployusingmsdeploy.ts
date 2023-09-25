import tl = require('azure-pipelines-task-lib/task');
import fs = require('fs');
import path = require('path');
import Q = require('q');
import { WebDeployArguments, WebDeployResult } from './msdeployutility';

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
        while(true) {
            try {
                retryCount -= 1;
                await executeMSDeploy(msDeployCmdArgs);
                break;
            }
            catch (error) {
                if(retryCount == 0) {
                    throw error;
                }
                console.log(error);
                console.log(tl.loc('RetryToDeploy'));
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
            tl.rmRF(setParametersFile);
        }
    }
}


export async function executeWebDeploy(WebDeployArguments: WebDeployArguments, publishingProfile: any): Promise<WebDeployResult> {
    var webDeployArguments = await msDeployUtility.getWebDeployArgumentsString(WebDeployArguments, publishingProfile);
    try {
        var msDeployPath = await msDeployUtility.getMSDeployFullPath();
        var msDeployDirectory = msDeployPath.slice(0, msDeployPath.lastIndexOf('\\') + 1);
        var pathVar = process.env.PATH;
        process.env.PATH = msDeployDirectory + ";" + process.env.PATH ;
        await executeMSDeploy(webDeployArguments);
    }
    catch(exception) {
        var msDeployErrorFilePath = tl.getVariable('System.DefaultWorkingDirectory') + '\\' + 'error.txt';
        var errorFileContent = tl.exist(msDeployErrorFilePath) ? fs.readFileSync(msDeployErrorFilePath, 'utf-8') : "";
        return {
            isSuccess: false,
            error: errorFileContent,
            errorCode: msDeployUtility.getWebDeployErrorCode(errorFileContent)
        } as WebDeployResult;
    }

    return { isSuccess: true } as WebDeployResult;
}

function argStringToArray(argString): string[] {
    var args = [];
    var inQuotes = false;
    var escaped = false;
    var arg = '';
    var append = function (c) {
        // we only escape double quotes.
        if (escaped && c !== '"') {
            arg += '\\';
        }
        arg += c;
        escaped = false;
    };
    for (var i = 0; i < argString.length; i++) {
        var c = argString.charAt(i);
        if (c === '"') {
            if (!escaped) {
                inQuotes = !inQuotes;
            }
            else {
                append(c);
            }
            continue;
        }
        if (c === "\\" && inQuotes) {
            if(escaped) {
                append(c);
            }
            else {
                escaped = true;
            }

            continue;
        }
        if (c === ' ' && !inQuotes) {
            if (arg.length > 0) {
                args.push(arg);
                arg = '';
            }
            continue;
        }
        append(c);
    }
    if (arg.length > 0) {
        args.push(arg.trim());
    }
    return args;
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
        tl.debug("the argument string is:");
        tl.debug(msDeployCmdArgs);
        tl.debug("converting the argument string into an array of arguments");
        msDeployCmdArgs = argStringToArray(msDeployCmdArgs);
        tl.debug("the array of arguments is:");
        for(var i = 0 ; i < msDeployCmdArgs.length ; i++ ) {
            tl.debug("arg#" + i + ": " + msDeployCmdArgs[i]);
        }
        await tl.exec("msdeploy", msDeployCmdArgs, <any>{failOnStdErr: true, errStream: errObj, windowsVerbatimArguments: true});
        deferred.resolve("Azure App service successfully deployed");
    } catch (error) {
        msDeployError = error;
    } finally {
        errObj.end();
    }
    return deferred.promise;
}
