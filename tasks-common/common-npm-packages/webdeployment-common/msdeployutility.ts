import tl = require('azure-pipelines-task-lib/task');
import fs = require('fs');
import path = require('path');
import { Package } from './packageUtility';
import * as winreg from 'winreg';
import * as semver from 'semver';

export const ERROR_FILE_NAME = "error.txt";
/**
 * Constructs argument for MSDeploy command
 * 
 * @param   webAppPackage                   Web deploy package
 * @param   webAppName                      web App Name
 * @param   profile                         Azure RM Connection Details
 * @param   removeAdditionalFilesFlag       Flag to set DoNotDeleteRule rule
 * @param   excludeFilesFromAppDataFlag     Flag to prevent App Data from publishing
 * @param   takeAppOfflineFlag              Flag to enable AppOffline rule
 * @param   virtualApplication              Virtual Application Name
 * @param   setParametersFile               Set Parameter File path
 * @param   additionalArguments             Arguments provided by user
 * @param   isParamFilePresentInPacakge     Flag to check Paramter.xml file
 * @param   isFolderBasedDeployment         Flag to check if given web package path is a folder
 * @param   authType                        Type of authentication to use
 * 
 * @returns string 
 */
export function getMSDeployCmdArgs(webAppPackage: string, webAppName: string, profile,
                             removeAdditionalFilesFlag: boolean, excludeFilesFromAppDataFlag: boolean, takeAppOfflineFlag: boolean,
                             virtualApplication: string, setParametersFile: string, additionalArguments: string, isParamFilePresentInPacakge: boolean,
                             isFolderBasedDeployment: boolean, useWebDeploy: boolean, authType?: string) : string {

    var msDeployCmdArgs: string = " -verb:sync";

    var webApplicationDeploymentPath = (virtualApplication) ? webAppName + "/" + virtualApplication : webAppName;
    
    if(isFolderBasedDeployment) {
        msDeployCmdArgs += " -source:IisApp=\"'" + webAppPackage + "'\"";
        msDeployCmdArgs += " -dest:iisApp=\"'" + webApplicationDeploymentPath + "'\"";
    }
    else {
        if (webAppPackage && webAppPackage.toLowerCase().endsWith('.war')) {
            tl.debug('WAR: webAppPackage = ' + webAppPackage);
            let warFile = path.basename(webAppPackage.slice(0, webAppPackage.length - '.war'.length));
            let warExt = webAppPackage.slice(webAppPackage.length - '.war'.length)
            tl.debug('WAR: warFile = ' + warFile);
            warFile = (virtualApplication) ? warFile + "/" + virtualApplication + warExt : warFile + warExt;
            tl.debug('WAR: warFile = ' + warFile);
            msDeployCmdArgs += " -source:contentPath=\"'" + webAppPackage + "'\"";
            // tomcat, jetty location on server => /site/webapps/
            tl.debug('WAR: dest = /site/webapps/' + warFile);
            msDeployCmdArgs += " -dest:contentPath=\"'/site/webapps/" + warFile + "'\"";
        } else {
            msDeployCmdArgs += " -source:package=\"'" + webAppPackage + "'\"";

            if(isParamFilePresentInPacakge) {
                msDeployCmdArgs += " -dest:auto";
            }
            else {
                msDeployCmdArgs += " -dest:contentPath=\"'" + webApplicationDeploymentPath + "'\"";
            }
        }
    }

    if(profile != null) {
        msDeployCmdArgs += `,ComputerName=\"'https://${profile.publishUrl}/msdeploy.axd?site=${webAppName}'\",`;
        msDeployCmdArgs += `UserName=\"'${profile.userName}'\",Password=\"'${profile.userPWD}'\",AuthType=\"'${authType || "Basic"}'\"`;
    }
    
    if(isParamFilePresentInPacakge) {
        msDeployCmdArgs += " -setParam:name=\"'IIS Web Application Name'\",value=\"'" + webApplicationDeploymentPath + "'\"";
    }

    if(takeAppOfflineFlag) {
        msDeployCmdArgs += ' -enableRule:AppOffline';
    }

    if(useWebDeploy) {
        if(setParametersFile) {
            msDeployCmdArgs += " -setParamFile=" + setParametersFile + " ";
        }

        if(excludeFilesFromAppDataFlag) {
            msDeployCmdArgs += ' -skip:Directory=App_Data';
        }
    }

    additionalArguments = additionalArguments ? escapeQuotes(additionalArguments) : ' ';
    msDeployCmdArgs += ' ' + additionalArguments;

    if(!(removeAdditionalFilesFlag && useWebDeploy)) {
        msDeployCmdArgs += " -enableRule:DoNotDeleteRule";
    }

    if(profile != null)
    {
        var userAgent = tl.getVariable("AZURE_HTTP_USER_AGENT");
        if(userAgent)
        {
            msDeployCmdArgs += ' -userAgent:' + userAgent;
        }
    }

    tl.debug('Constructed msDeploy comamnd line arguments');
    return msDeployCmdArgs;
}


/**
 * Escapes quotes in a string to ensure proper command-line parsing.
 * @param {string} additionalArguments - The string to format.
 * @returns {string} The formatted string with escaped quotes.
 */
function escapeQuotes(additionalArguments: string): string {
    const parsedArgs = parseAdditionalArguments(additionalArguments);
    const separator = ",";

    const formattedArgs = parsedArgs.map(function (arg) {
        let formattedArg = '';
        let equalsSignEncountered = false;
        for (let i = 0; i < arg.length; i++) {
            const char = arg.charAt(i);
            if (char == separator && equalsSignEncountered) {
                equalsSignEncountered = false;
                arg = arg.replace(formattedArg, escapeArg(formattedArg));
                formattedArg = '';
                continue;
            }
            if (equalsSignEncountered) {
                formattedArg += char;
            } 
            if (char == '=') {
                equalsSignEncountered = true;
            } 
        };

        if (formattedArg.length > 0) {
            arg = arg.replace(formattedArg, escapeArg(formattedArg));
        }

        return arg;
    });

    return formattedArgs.join(' ');
}
exports.escapeQuotes = escapeQuotes;

/**
 * Escapes special characters in a string to ensure proper command-line parsing.
 * @param {string} arg - The string to format.
 * @returns {string} The formatted string with escaped characters.
 */
function escapeArg(arg: string): string {
    var escapedChars = new RegExp(/[\\\^\.\*\?\-\&\|\(\)\<\>\t\n\r\f]/);
    // If the argument starts with dowble quote and ends with double quote, the replace it with escaped double quotes
    if (arg.startsWith('"') && arg.endsWith('"')) {
        return '"\\' + arg.slice(0, arg.length - 1) + '\\""';
    }
    // If the argument starts with single quote and ends with single quote, then replace it with escaped double qoutes
    if (arg.startsWith("'") && arg.endsWith("'")) {
        return '"\\"' + arg.slice(1, arg.length - 1) + '\\""';
    }

    if (escapedChars.test(arg)) {
        return '"\\"' + arg + '\\""';
    }
    return arg;
}

/**
 * Parses additional arguments for the msdeploy command-line utility.
 * @param {string} additionalArguments - The additional arguments to parse.
 * @returns {string[]} An array of parsed arguments.
 */
function parseAdditionalArguments(additionalArguments: string): string[] {
    var parsedArgs = [];
    var isInsideQuotes = false;
    for (let i = 0; i < additionalArguments.length; i++) {
        var arg = '';
        var qouteSymbol = '';
        let char = additionalArguments.charAt(i);
        // command parse start
        if (char === '-') {
            while (i < additionalArguments.length) {
                char = additionalArguments.charAt(i);
                const prevSym = additionalArguments.charAt(i - 1);
                // If we reach space and we are not inside quotes, then it is the end of the argument
                if (char === ' ' && !isInsideQuotes) break;
                // If we reach unescaped comma and we inside qoutes we assume that it is the end of quoted line
                if (isInsideQuotes && char === qouteSymbol &&  prevSym !== '\\') {
                    isInsideQuotes = false;
                    qouteSymbol = '';
                // If we reach unescaped comma and we are not inside qoutes we assume that it is the beggining of quoted line
                } else if (!isInsideQuotes && (char === '"' || char === "'") &&  prevSym !== '\\') {
                    isInsideQuotes = !isInsideQuotes;
                    qouteSymbol = char;
                }

                arg += char;
                i += 1;
            }
            parsedArgs.push(arg);
        }
    }
    return parsedArgs;
}



export async function getWebDeployArgumentsString(args: WebDeployArguments): Promise<string> {
    const profile = {
        userPWD: args.password,
        userName: args.userName,
        publishUrl: args.publishUrl
    };

    return getMSDeployCmdArgs(
        args.package.getPath(),
        args.appName, 
        profile, 
        args.removeAdditionalFilesFlag,
        args.excludeFilesFromAppDataFlag,
        args.takeAppOfflineFlag,
        args.virtualApplication,
        args.setParametersFile,
        args.additionalArguments,
        await args.package.isMSBuildPackage(),
        args.package.isFolder(),
        args.useWebDeploy,
        args.authType);
}

export function shouldUseMSDeployTokenAuth(): boolean {
    return (tl.getVariable("USE_MSDEPLOY_TOKEN_AUTH") || "").toLowerCase() === "true";
}

/**
 * Gets the full path of MSDeploy.exe
 * 
 * @returns    string
 */
export async function getMSDeployFullPath(): Promise<string> {
    try {      
        const msDeployFolder = await getMSDeployInstallPath();  
        return path.join(msDeployFolder,  "msdeploy.exe");
    }
    catch (error) {
        tl.debug(error);
        const subfolder = shouldUseMSDeployTokenAuth() ? "M229" : "M142";
        return path.join(__dirname, "MSDeploy", subfolder , "MSDeploy3.6", "msdeploy.exe");
    }
}

async function getMSDeployInstallPath(): Promise<string> {
    const regKey = await getMSDeployLatestRegKey();
    return new Promise<string>((resolve, reject) => {
        regKey.get("InstallPath", function (err, item) {
            if (err) {
                reject(tl.loc("MissingMSDeployInstallPathRegistryKey"));
            }
            resolve(item.value);
        });
    });
}

export async function getInstalledMSDeployVersion(): Promise<string> {
    let regKey: winreg.Registry;
    try {
        regKey = await getMSDeployLatestRegKey();
    }
    catch(err) {
        tl.debug("An error occured while loading msdeploy registry values: " + err);
        return undefined;
    }

    return new Promise<string>((resolve, _) => {
        regKey.get("Version", function (err, item) {
            if (err) {
                tl.debug("An error occured while loading msdeploy version from registry: " + err);
                resolve(undefined);
            }
            const version = item.value;
            tl.debug(`Installed MSDeploy Version: ${version}`);
            resolve(version);
        });
    });
}

export async function installedMSDeployVersionSupportsTokenAuth(): Promise<boolean | undefined> {
    const msDeployVersionString = await getInstalledMSDeployVersion();
    if (!msDeployVersionString) {
        tl.debug('Could not determine MSDeploy version. Assuming it is not installed.');
        return undefined;
    }

    const msDeployVersion = semver.coerce(msDeployVersionString);
    // MSDeploy 9.0.7225 is the first product version to support token auth
    if (semver.gte(msDeployVersion, semver.coerce("9.0.7225"))) {
        return true;
    }

    // MDeploy shipped with Web Deploy has different versioning scheme
    // Versions between 9.0.2000 and 9.0.2999 are considered to be similar to 9.0.7225
    return semver.gte(msDeployVersion, semver.coerce("9.0.2000")) && semver.lte(msDeployVersion, semver.coerce("9.0.2999"));
}

function getMSDeployLatestRegKey(): Promise<winreg.Registry> {
    return new Promise<winreg.Registry>((resolve, reject) => {
        const minimalSupportedMSDeployVersion = 3;
        const msdeployRegistryPath = "\\SOFTWARE\\Microsoft\\IIS Extensions\\MSDeploy";
        const regKey = new winreg({
            hive: winreg.HKLM,
            key: msdeployRegistryPath
        });

        regKey.keys(function (err, subRegKeys) {
            if (err) {
                reject(tl.loc("UnabletofindthelocationofMSDeployfromregistryonmachineError", err));
                return;
            }

            tl.debug(`Found ${subRegKeys.length} subkeys under ${msdeployRegistryPath}`);

            let latestKeyVersion = 0;
            let latestSubKey: winreg.Registry;

            for (var index in subRegKeys) {
                const subRegKey = subRegKeys[index].key;
                tl.debug("Found subkey " + subRegKey);
                const subKeyVersion = subRegKey.substring(subRegKey.lastIndexOf("\\") + 1);
                const subKeyVersionNumber = parseFloat(subKeyVersion);
                if (!isNaN(subKeyVersionNumber) && subKeyVersionNumber > latestKeyVersion) {
                    latestKeyVersion = subKeyVersionNumber;
                    latestSubKey = subRegKeys[index];
                }
            }
            if (latestKeyVersion < minimalSupportedMSDeployVersion) {
                // previous versions are not compatible either with app services or web deployment tasks
                reject(tl.loc("UnsupportedinstalledversionfoundforMSDeployversionshouldbeatleast3orabove", latestKeyVersion));
                return;
            }
            resolve(latestSubKey);
        });
    });
}

/**
 * 1. Checks if msdeploy during execution redirected any error to 
 * error stream ( saved in error.txt) , display error to console
 * 2. Checks if there is file in use error , suggest to try app offline.
 */
export function redirectMSDeployErrorToConsole() {
    var msDeployErrorFilePath = tl.getVariable('System.DefaultWorkingDirectory') + '\\' + ERROR_FILE_NAME;
    
    if(tl.exist(msDeployErrorFilePath)) {
        var errorFileContent = fs.readFileSync(msDeployErrorFilePath).toString();

        if(errorFileContent !== "") {
            if(errorFileContent.indexOf("ERROR_INSUFFICIENT_ACCESS_TO_SITE_FOLDER") !== -1) {
                tl.warning(tl.loc("Trytodeploywebappagainwithappofflineoptionselected"));
            }
            else if(errorFileContent.indexOf("An error was encountered when processing operation 'Delete Directory' on 'D:\\home\\site\\wwwroot\\app_data\\jobs'") !== -1) {
                tl.warning(tl.loc('WebJobsInProgressIssue'));
            }
            else if(errorFileContent.indexOf("FILE_IN_USE") !== -1) {
                tl.warning(tl.loc("Trytodeploywebappagainwithrenamefileoptionselected"));
            }
            else if(errorFileContent.indexOf("transport connection") != -1){
                errorFileContent = errorFileContent + tl.loc("Updatemachinetoenablesecuretlsprotocol");
            }
          
            tl.error(errorFileContent);
        }

        tl.rmRF(msDeployErrorFilePath);
    }
}

export function getWebDeployErrorCode(errorMessage): string {
    if(errorMessage !== "") {
        if(errorMessage.indexOf("ERROR_INSUFFICIENT_ACCESS_TO_SITE_FOLDER") !== -1) {
            return "ERROR_INSUFFICIENT_ACCESS_TO_SITE_FOLDER";
        }
        else if(errorMessage.indexOf("An error was encountered when processing operation 'Delete Directory' on 'D:\\home\\site\\wwwroot\\app_data\\jobs") !== -1) {
            return "WebJobsInProgressIssue";
        }
        else if(errorMessage.indexOf("FILE_IN_USE") !== -1) {
            return "FILE_IN_USE";
        }
        else if(errorMessage.indexOf("transport connection") != -1){
            return "transport connection";
        }
        else if(errorMessage.indexOf("ERROR_CONNECTION_TERMINATED") != -1) {
            return "ERROR_CONNECTION_TERMINATED"
        }
        else if(errorMessage.indexOf("ERROR_CERTIFICATE_VALIDATION_FAILED") != -1) {
            return "ERROR_CERTIFICATE_VALIDATION_FAILED";
        }
    }

    return "";
}

export interface WebDeployArguments {
    package: Package;
    appName: string;
    publishUrl?: string;
    userName?: string;
    password?: string;
    removeAdditionalFilesFlag?: boolean;
    excludeFilesFromAppDataFlag?: boolean;
    takeAppOfflineFlag?: boolean;
    virtualApplication?: string;
    setParametersFile?: string
    additionalArguments?: string;
    useWebDeploy?: boolean;
    authType?: string;
}


export interface WebDeployResult {
    isSuccess: boolean;
    errorCode?: string;
    error?: string;
}