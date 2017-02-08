import tl = require('vsts-task-lib/task');
import path = require('path');

var zipUtility = require('webdeployment-common/ziputility.js');
var utility = require('webdeployment-common/utility.js');
var jsonSubstitutionUtility = require('webdeployment-common/jsonvariablesubstitutionutility.js');
var xmlSubstitutionUtility = require('webdeployment-common/xmlvariablesubstitutionutility.js');
var xdtTransformationUtility = require('webdeployment-common/xdttransformationutility.js');

export async function fileTransformations(isFolderBasedDeployment: boolean, JSONFiles: any, xmlTransformation: boolean, xmlVariableSubstitution: boolean, webDeployPkg: string) {

    var tempPackagePath;
    var folderPath = utility.generateTemporaryFolderOrZipPath(tl.getVariable('System.DefaultWorkingDirectory'), true);
        
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
            xdtTransformationUtility.basicXdtTransformation(folderPath, transformConfigs);  
            console.log(tl.loc("XDTTransformationsappliedsuccessfully"));
        }
        else {
            throw new Error(tl.loc("CannotPerformXdtTransformationOnNonWindowsPlatform"));
        }
    }

    if(xmlVariableSubstitution) {
        await xmlSubstitutionUtility.substituteAppSettingsVariables(folderPath, isFolderBasedDeployment);
        console.log(tl.loc('XMLvariablesubstitutionappliedsuccessfully'));
    }

    if(JSONFiles.length != 0) {
        jsonSubstitutionUtility.jsonVariableSubstitution(folderPath, JSONFiles);
        console.log(tl.loc('JSONvariablesubstitutionappliedsuccessfully'));
    }

    if(isFolderBasedDeployment) {
        tempPackagePath = folderPath;
        webDeployPkg = folderPath;
    }
    else {
        var tempWebPackageZip = utility.generateTemporaryFolderOrZipPath(tl.getVariable('System.DefaultWorkingDirectory'), false);
        webDeployPkg = await zipUtility.archiveFolder(folderPath, "", tempWebPackageZip);
        tempPackagePath = webDeployPkg;
        tl.rmRF(folderPath, true);
    }

    return {
        "webDeployPkg": webDeployPkg,
        "tempPackagePath": tempPackagePath
    };
}