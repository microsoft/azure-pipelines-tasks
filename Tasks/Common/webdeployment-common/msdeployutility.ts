import Q = require('q');
import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');
import fs = require('fs');
import path = require('path');

var zipUtility = require('./ziputility.js');
var winreg = require('winreg');
var parseString = require('xml2js').parseString;

/**
 * Constructs argument for MSDeploy command
 * 
 * @param   webAppPackage                   Web deploy package
 * @param   webAppName                      web App Name
 * @param   publishingProfile               Azure RM Connection Details
 * @param   removeAdditionalFilesFlag       Flag to set DoNotDeleteRule rule
 * @param   excludeFilesFromAppDataFlag     Flag to prevent App Data from publishing
 * @param   takeAppOfflineFlag              Flag to enable AppOffline rule
 * @param   virtualApplication              Virtual Application Name
 * @param   setParametersFile               Set Parameter File path
 * @param   additionalArguments             Arguments provided by user
 * @param   isParamFilePresentInPacakge     Flag to check Paramter.xml file
 * @param   isFolderBasedDeployment         Flag to check if given web package path is a folder
 * 
 * @returns string 
 */
export function getMSDeployCmdArgs(webAppPackage: string, webAppName: string, publishingProfile,
                             removeAdditionalFilesFlag: boolean, excludeFilesFromAppDataFlag: boolean, takeAppOfflineFlag: boolean,
                             virtualApplication: string, setParametersFile: string, additionalArguments: string, isParamFilePresentInPacakge: boolean,
                             isFolderBasedDeployment: boolean, useWebDeploy: boolean) : string {

    var msDeployCmdArgs: string = " -verb:sync";

    var webApplicationDeploymentPath = (virtualApplication) ? webAppName + "/" + virtualApplication : webAppName;
    
    if(isFolderBasedDeployment) {
        msDeployCmdArgs += " -source:IisApp=\'" + webAppPackage + "\'";
        msDeployCmdArgs += " -dest:iisApp=\'" + webApplicationDeploymentPath + "\'";
    }
    else {       
        msDeployCmdArgs += " -source:package=\'" + webAppPackage + "\'";

        if(isParamFilePresentInPacakge) {
            msDeployCmdArgs += " -dest:auto";
        }
        else {
            msDeployCmdArgs += " -dest:contentPath=\'" + webApplicationDeploymentPath + "\'";
        }
    }

	if(publishingProfile != null) {
		msDeployCmdArgs += ",ComputerName='https://" + publishingProfile.publishUrl + "/msdeploy.axd?site=" + webAppName + "',";
		msDeployCmdArgs += "UserName='" + publishingProfile.userName + "',Password='" + publishingProfile.userPWD + "',AuthType='Basic'";
	}
	
    if(isParamFilePresentInPacakge) {
        msDeployCmdArgs += " -setParam:name='IIS Web Application Name',value='" + webApplicationDeploymentPath + "'";
    }

    if(useWebDeploy) {

        if(setParametersFile) {
            msDeployCmdArgs += " -setParamFile=" + setParametersFile + " ";
        }

        if(takeAppOfflineFlag) {
            msDeployCmdArgs += ' -enableRule:AppOffline';
        }

        if(excludeFilesFromAppDataFlag) {
            msDeployCmdArgs += ' -skip:Directory=App_Data';
        }
        
        if(additionalArguments) {
            msDeployCmdArgs += ' ' + additionalArguments;
        }
    }

    if(!(removeAdditionalFilesFlag && useWebDeploy)) {
        msDeployCmdArgs += " -enableRule:DoNotDeleteRule";
    }

    if(publishingProfile != null)
	{
		var userAgent = tl.getVariable("AZURE_HTTP_USER_AGENT");
		if(userAgent)
		{
			msDeployCmdArgs += ' -userAgent:' + userAgent;
		}
	}

    tl.debug(tl.loc('ConstructedmsDeploycomamndlinearguments'));
    return msDeployCmdArgs;
}

/**
 * Check whether the package contains parameter.xml file
 * @param   webAppPackage   web deploy package
 * @returns boolean
 */
export async  function containsParamFile(webAppPackage: string ) {
    var isParamFilePresent = false;
    var isParamFilePresentBackup;
    try {
        isParamFilePresentBackup = await isMSDeployPackage(webAppPackage);
    }
    catch (error) {
        isParamFilePresentBackup = false;
        tl.debug("an error occurred in the function isMSDeployPackage");
    }
    var msDeployCheckParamFileCmdArgs = "-verb:getParameters -source:package=\'" + webAppPackage + "\'";
    var res =  tl.execSync("msdeploy", msDeployCheckParamFileCmdArgs, <any>{ failOnStdErr: true, cwd: tl.getVariable('System.DefaultWorkingDirectory') });    

    if((res.error && res.error.message.length > 0 ) || (res.stderr && res.stderr.length > 0)) {
        tl.debug("[COMMAND FAILED]: msdeploy " + msDeployCheckParamFileCmdArgs);
        if(res.error) {
            tl.debug("res.error: " + res.error.message);
        }
        if(res.stderr) {
            tl.debug("res.stderr: " + res.stderr);
        }
        isParamFilePresent = isParamFilePresentBackup;
        tl.debug("Is parameter file present in web package : " + isParamFilePresent);
        return isParamFilePresent;
    }

    var paramContentXML = res.stdout;

    await parseString(paramContentXML, (error, result) => {
        if(error) {
            isParamFilePresent = isParamFilePresentBackup;
        }
        if(result != null && result['output'] != null && result['output']['parameters'] != null) {
            if(result['output']['parameters'][0] ) {
                isParamFilePresent = true;
            }
        }
        else {
            isParamFilePresent = isParamFilePresentBackup;
            tl.warning("Parameter file is not well formed");
            tl.debug("Parameter File Content is:");
            tl.debug(paramContentXML);
        }
    });
    tl.debug(tl.loc("Isparameterfilepresentinwebpackage0", isParamFilePresent));
    return isParamFilePresent;
}

/**
 * Check whether the package contains parameter.xml file
 * @param   webAppPackage   web deploy package
 * @returns boolean
 */
async function isMSDeployPackage(webAppPackage: string ) {
    var isParamFilePresent = false;
    var pacakgeComponent = await zipUtility.getArchivedEntries(webAppPackage);
    if (((pacakgeComponent["entries"].indexOf("parameters.xml") > -1) || (pacakgeComponent["entries"].indexOf("Parameters.xml") > -1)) && 
    ((pacakgeComponent["entries"].indexOf("systeminfo.xml") > -1) || (pacakgeComponent["entries"].indexOf("systemInfo.xml") > -1))) {
        isParamFilePresent = true;
    }
    tl.debug("Is parameter file present in web package : " + isParamFilePresent);
    return isParamFilePresent;
}

/**
 * Gets the full path of MSDeploy.exe
 * 
 * @returns    string
 */
export async function getMSDeployFullPath() {
    try {
        var msDeployInstallPathRegKey = "\\SOFTWARE\\Microsoft\\IIS Extensions\\MSDeploy";
        var msDeployLatestPathRegKey = await getMSDeployLatestRegKey(msDeployInstallPathRegKey);
        var msDeployFullPath = await getMSDeployInstallPath(msDeployLatestPathRegKey);
        msDeployFullPath = msDeployFullPath + "msdeploy.exe";
        return msDeployFullPath;
    }
    catch(error) {
        tl.warning(error);
        return path.join(__dirname, "..", "..", "MSDeploy3.6", "msdeploy.exe"); 
    }
}

function getMSDeployLatestRegKey(registryKey: string): Q.Promise<string> {
    var defer = Q.defer<string>();
    var regKey = new winreg({
      hive: winreg.HKLM,
      key:  registryKey
    })

    regKey.keys(function(err, subRegKeys) {
        if(err) {
            defer.reject(tl.loc("UnabletofindthelocationofMSDeployfromregistryonmachineError", err));
        }
        var latestKeyVersion = 0 ;
        var latestSubKey;
        for(var index in subRegKeys) {
            var subRegKey = subRegKeys[index].key;
            var subKeyVersion = subRegKey.substr(subRegKey.lastIndexOf('\\') + 1, subRegKey.length - 1);
            if(!isNaN(subKeyVersion)){
                var subKeyVersionNumber = parseFloat(subKeyVersion);
                if(subKeyVersionNumber > latestKeyVersion) {
                    latestKeyVersion = subKeyVersionNumber;
                    latestSubKey = subRegKey;
                }
            }
        }
        if(latestKeyVersion < 3) {
            defer.reject(tl.loc("UnsupportedinstalledversionfoundforMSDeployversionshouldbealteast3orabove", latestKeyVersion));
        }
         defer.resolve(latestSubKey);
    });
    return defer.promise;
}

function getMSDeployInstallPath(registryKey: string): Q.Promise<string> {
    var defer = Q.defer<string>();

    var regKey = new winreg({
      hive: winreg.HKLM,
      key:  registryKey
    })

    regKey.get("InstallPath", function(err,item) {
        if(err) {
            defer.reject(tl.loc("UnabletofindthelocationofMSDeployfromregistryonmachineError", err));
        }
        defer.resolve(item.value);
    });

    return defer.promise;
}

/**
 * 1. Checks if msdeploy during execution redirected any error to 
 * error stream ( saved in error.txt) , display error to console
 * 2. Checks if there is file in use error , suggest to try app offline.
 */
export function redirectMSDeployErrorToConsole(publishProfile: any) {
    var msDeployErrorFilePath = tl.getVariable('System.DefaultWorkingDirectory') + '\\error.txt';

    if(tl.exist(msDeployErrorFilePath)) {
        var errorFileContent = fs.readFileSync(msDeployErrorFilePath);
        
        if(errorFileContent.toString() === "") {
            if(publishProfile != null) {
                console.log(tl.loc('WebappsuccessfullypublishedatUrl0', publishProfile.destinationAppUrl));
            }
        }
        else {
            if(errorFileContent.toString().indexOf("ERROR_INSUFFICIENT_ACCESS_TO_SITE_FOLDER") !== -1){
                tl.warning(tl.loc("Trytodeploywebappagainwithappofflineoptionselected"));
            }
            
            tl.error(errorFileContent.toString());
            tl.rmRF(msDeployErrorFilePath);
        }
    }
}