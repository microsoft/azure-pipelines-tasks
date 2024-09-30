import tl = require('azure-pipelines-task-lib/task');
import * as ParameterParser from './ParameterParserUtility';
import { PackageType } from './packageUtility';
import { parse } from './ParameterParserUtility';
var deployUtility = require('./utility.js');
var generateWebConfigUtil = require('./webconfigutil.js');
var jsonSubstitutionUtility = require('azure-pipelines-tasks-webdeployment-common/jsonvariablesubstitutionutility.js');
var xmlSubstitutionUtility = require('azure-pipelines-tasks-webdeployment-common/xmlvariablesubstitutionutility.js');
var xdtTransformationUtility = require('azure-pipelines-tasks-webdeployment-common/xdttransformationutility.js');

export function fileTransformations(isFolderBasedDeployment: boolean, JSONFiles: any, xmlTransformation: boolean, xmlVariableSubstitution: boolean, folderPath: string, isMSBuildPackage: boolean) {

    if(xmlTransformation) {
        if(isMSBuildPackage) {
            var debugMode = tl.getVariable('system.debug');
            if(debugMode && debugMode.toLowerCase() == 'true') {
                tl.warning(tl.loc('AutoParameterizationMessage'));
            }
            else {
                console.log(tl.loc('AutoParameterizationMessage'));
            }
        }
        var environmentName = tl.getVariable('Release.EnvironmentName');
        if(tl.osType().match(/^Win/)) {
            var transformConfigs = ["Release.config"];
            if(environmentName && environmentName.toLowerCase() != 'release') {
                transformConfigs.push(environmentName + ".config");
            }
            var isTransformationApplied: boolean = xdtTransformationUtility.basicXdtTransformation(folderPath, transformConfigs);

            if(isTransformationApplied)
            {
                console.log(tl.loc("XDTTransformationsappliedsuccessfully"));
            }

        }
        else {
            throw new Error(tl.loc("CannotPerformXdtTransformationOnNonWindowsPlatform"));
        }
    }

    if(xmlVariableSubstitution) {
        xmlSubstitutionUtility.substituteAppSettingsVariables(folderPath, isFolderBasedDeployment);
        console.log(tl.loc('XMLvariablesubstitutionappliedsuccessfully'));
    }

    if(JSONFiles.length != 0) {
        jsonSubstitutionUtility.jsonVariableSubstitution(folderPath, JSONFiles);
        console.log(tl.loc('JSONvariablesubstitutionappliedsuccessfully'));
    }
}

export function advancedFileTransformations(isFolderBasedDeployment: boolean, targetFiles: any, xmlTransformation: boolean, variableSubstitutionFileFormat: string, folderPath: string, transformationRules: any) {

    if(xmlTransformation) {
        if(!tl.osType().match(/^Win/)) {
            throw Error(tl.loc("CannotPerformXdtTransformationOnNonWindowsPlatform"));
        }
        else {
            let isTransformationApplied: boolean = true;
            if(transformationRules.length > 0) {
                transformationRules.forEach(function(rule) {
                    var args = ParameterParser.parse(rule);
                    if(Object.keys(args).length < 2 || !args["transform"] || !args["xml"]) {
                        tl.error(tl.loc("MissingArgumentsforXMLTransformation"));
                    }
                    else if(Object.keys(args).length > 2) {
                        isTransformationApplied = xdtTransformationUtility.specialXdtTransformation(folderPath, args["transform"].value, args["xml"].value, args["result"].value) && isTransformationApplied;
                    }
                    else {
                        isTransformationApplied = xdtTransformationUtility.specialXdtTransformation(folderPath, args["transform"].value, args["xml"].value) && isTransformationApplied;
                    }
                });
            }
            else{
                var environmentName = tl.getVariable('Release.EnvironmentName');
                let transformConfigs = ["Release.config"];
                if(environmentName && environmentName.toLowerCase() != 'release') {
                    transformConfigs.push(environmentName + ".config");
                }
                isTransformationApplied = xdtTransformationUtility.basicXdtTransformation(folderPath, transformConfigs);
            }

            if(isTransformationApplied) {
                console.log(tl.loc("XDTTransformationsappliedsuccessfully"));
            }
            else {
                tl.warning(tl.loc('FailedToApplySpecialTransformation'));
            }
        }
    }

    if(variableSubstitutionFileFormat === "xml") {
        if(targetFiles.length == 0) {
            xmlSubstitutionUtility.substituteAppSettingsVariables(folderPath, isFolderBasedDeployment);
        }
        else {
            targetFiles.forEach(function(fileName) {
                xmlSubstitutionUtility.substituteAppSettingsVariables(folderPath, isFolderBasedDeployment, fileName);
            });
        }

        console.log(tl.loc('XMLvariablesubstitutionappliedsuccessfully'));

    }

    if(variableSubstitutionFileFormat === "json") {
        // For Json variable substitution if no target files are specified file files matching **\*.json
        if(!targetFiles || targetFiles.length == 0) {
            targetFiles = ["**/*.json"];
        }
        jsonSubstitutionUtility.jsonVariableSubstitution(folderPath, targetFiles, true);
        console.log(tl.loc('JSONvariablesubstitutionappliedsuccessfully'));
    }
}

export function enhancedFileTransformations(isFolderBasedDeployment: boolean, xmlTransformation: boolean, folderPath: string, transformationRules: any, xmlTargetFiles: any, jsonTargetFiles: any) {

    if(xmlTransformation) {
        if(!tl.osType().match(/^Win/)) {
            throw Error(tl.loc("CannotPerformXdtTransformationOnNonWindowsPlatform"));
        }
        else {
            let isTransformationApplied: boolean = true;
            if(transformationRules.length > 0) {
                transformationRules.forEach(function(rule) {
                    var args = ParameterParser.parse(rule);
                    if(Object.keys(args).length < 2 || !args["transform"] || !args["xml"]) {
                        tl.error(tl.loc("MissingArgumentsforXMLTransformation"));
                    }
                    else if(Object.keys(args).length > 2) {
                        isTransformationApplied = xdtTransformationUtility.specialXdtTransformation(folderPath, args["transform"].value, args["xml"].value, args["result"].value) && isTransformationApplied;
                    }
                    else {
                        isTransformationApplied = xdtTransformationUtility.specialXdtTransformation(folderPath, args["transform"].value, args["xml"].value) && isTransformationApplied;
                    }
                });
            }
            if(isTransformationApplied) {
                console.log(tl.loc("XDTTransformationsappliedsuccessfully"));
            }
            else {
                tl.error(tl.loc('FailedToApplySpecialTransformationReason1'));
            }
        }
    }

    let isSubstitutionApplied: boolean = true;
    if(xmlTargetFiles.length > 0)
    {
        xmlTargetFiles.forEach(function(fileName) {
            isSubstitutionApplied = xmlSubstitutionUtility.substituteAppSettingsVariables(folderPath, isFolderBasedDeployment, fileName) || isSubstitutionApplied;
        });

        if(isSubstitutionApplied) {
            console.log(tl.loc('XMLvariablesubstitutionappliedsuccessfully'));
        }
        else {
            tl.error(tl.loc('FailedToApplyXMLvariablesubstitutionReason1'));
        }
    }

    isSubstitutionApplied = true;
    if(jsonTargetFiles.length > 0)
    {
        isSubstitutionApplied = jsonSubstitutionUtility.jsonVariableSubstitution(folderPath, jsonTargetFiles, true);
        if(isSubstitutionApplied) {
            console.log(tl.loc('JSONvariablesubstitutionappliedsuccessfully'));
        }
        else {
            tl.error(tl.loc('FailedToApplyJSONvariablesubstitutionReason1'));
        }
    }
}
/** Generate web config file from parameters object, add it to temp directory that is archived afterwards and returned as a package */
export async function applyTransformations(webPackage: string, parameters: string, packageType: PackageType): Promise<string> {
    tl.debug("WebConfigParameters is "+ parameters);
    if (parameters) {
        const isFolderBasedDeployment: boolean = tl.stats(webPackage).isDirectory();
        const folderPath = await deployUtility.generateTemporaryFolderForDeployment(isFolderBasedDeployment, webPackage, packageType);
        if (parameters) {
            tl.debug('parsing web.config parameters');
            const webConfigParameters = parse(parameters);
            const rootDirectoryPath: string = "D:\\home\\site\\wwwroot";
            generateWebConfigUtil.addWebConfigFile(folderPath, webConfigParameters, rootDirectoryPath);
        }

        const output = await deployUtility.archiveFolderForDeployment(isFolderBasedDeployment, folderPath);
        webPackage = output.webDeployPkg;
    }
    else {
        tl.debug('File Tranformation not enabled');
    }

    return webPackage;
}