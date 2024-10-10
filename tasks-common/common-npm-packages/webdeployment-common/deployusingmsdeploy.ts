import tl = require('azure-pipelines-task-lib/task');
import { IExecOptions } from 'azure-pipelines-task-lib/toolrunner';
import fs = require('fs');
import path = require('path');

import { copySetParamFileIfItExists, isMSDeployPackage } from './utility'; 
import { 
    WebDeployArguments, 
    WebDeployResult, 
    getMSDeployFullPath, 
    getWebDeployArgumentsString, 
    getWebDeployErrorCode,
    getMSDeployCmdArgs,
    redirectMSDeployErrorToConsole,
    ERROR_FILE_NAME
} from './msdeployutility';

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
        excludeFilesFromAppDataFlag, takeAppOfflineFlag, virtualApplication, setParametersFile, additionalArguments, isFolderBasedDeployment, useWebDeploy, authType?: string) {

    var msDeployPath = await getMSDeployFullPath();
    var msDeployDirectory = msDeployPath.slice(0, msDeployPath.lastIndexOf('\\') + 1);
    var pathVar = process.env.PATH;
    process.env.PATH = msDeployDirectory + ";" + process.env.PATH ;

    setParametersFile = copySetParamFileIfItExists(setParametersFile);
    var setParametersFileName = null;

    if(setParametersFile != null) {
        setParametersFileName = setParametersFile.slice(setParametersFile.lastIndexOf('\\') + 1, setParametersFile.length);
    }
    var isParamFilePresentInPackage = isFolderBasedDeployment ? false : await isMSDeployPackage(webDeployPkg);

    var msDeployCmdArgs = getMSDeployCmdArgs(webDeployPkg, webAppName, publishingProfile, removeAdditionalFilesFlag,
        excludeFilesFromAppDataFlag, takeAppOfflineFlag, virtualApplication, setParametersFileName, additionalArguments, isParamFilePresentInPackage, isFolderBasedDeployment,
        useWebDeploy, authType);

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
        redirectMSDeployErrorToConsole();
        throw Error(error.message);
    }
    finally {
        process.env.PATH = pathVar;
        if(setParametersFile != null) {
            tl.rmRF(setParametersFile);
        }
    }
}


export async function executeWebDeploy(webDeployArguments: WebDeployArguments): Promise<WebDeployResult> {
    const args = await getWebDeployArgumentsString(webDeployArguments);
    const originalPathVar = process.env.PATH;
    try {
        const msDeployPath: string = await getMSDeployFullPath();
        const msDeployDirectory = msDeployPath.slice(0, msDeployPath.lastIndexOf('\\') + 1);
        process.env.PATH = msDeployDirectory + ";" + process.env.PATH;
        await executeMSDeploy(args);
        return {
            isSuccess: true
        } as WebDeployResult;
    }
    catch (exception) {
        tl.debug(JSON.stringify(exception));
        const msDeployErrorFilePath = tl.getVariable('System.DefaultWorkingDirectory') + '\\' + 'error.txt';
        const errorFileContent = tl.exist(msDeployErrorFilePath) ? fs.readFileSync(msDeployErrorFilePath, 'utf-8') : "";
        return {
            isSuccess: false,
            error: errorFileContent,
            errorCode: getWebDeployErrorCode(errorFileContent)
        } as WebDeployResult;
    }
    finally {
        process.env.PATH = originalPathVar;
    }
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

async function executeMSDeploy(msDeployCmdArgs: string): Promise<any> {
    return new Promise<any>(async (resolve, reject) => {
        const errorFile = path.join(tl.getVariable('System.DefaultWorkingDirectory'), ERROR_FILE_NAME);
        const fd = fs.openSync(errorFile, "w");
        const errorStream = fs.createWriteStream("", { fd: fd });

        let msDeployError = null;

        errorStream.on('finish', async () => {
            if (msDeployError) {
                reject(msDeployError);
            }
        });

        try {
            tl.debug("the argument string is:");
            tl.debug(msDeployCmdArgs);
            tl.debug("converting the argument string into an array of arguments");
            const msDeployCmdArgsArray = argStringToArray(msDeployCmdArgs);
            tl.debug("the array of arguments is:");
            for (let i = 0; i < msDeployCmdArgsArray.length; i++) {
                tl.debug("arg#" + i + ": " + msDeployCmdArgsArray[i]);
            }
            // set shell: true because C:\Program Files\IIS\Microsoft Web Deploy V3\msdeploy.exe has folder with spaces 
            // see https://github.com/microsoft/azure-pipelines-tasks/issues/17634
            const options: IExecOptions = { 
                failOnStdErr: true, 
                errStream: errorStream, 
                windowsVerbatimArguments: true, 
                shell: true
            };
            await tl.exec("msdeploy", msDeployCmdArgsArray, options);
            resolve("Azure App service successfully deployed");
        } catch (error) {
            msDeployError = error;
        } finally {
            errorStream.end();
        }
    });
}
