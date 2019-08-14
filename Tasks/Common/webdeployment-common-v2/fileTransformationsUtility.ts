import tl = require('azure-pipelines-task-lib/task');
import * as ParameterParser from './ParameterParserUtility';

var jsonSubstitutionUtility = require('webdeployment-common-v2/jsonvariablesubstitutionutility.js');
var xmlSubstitutionUtility = require('webdeployment-common-v2/xmlvariablesubstitutionutility.js');
var xdtTransformationUtility = require('webdeployment-common-v2/xdttransformationutility.js');

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
            }
            if(isTransformationApplied) {
                console.log(tl.loc("XDTTransformationsappliedsuccessfully"));
            }
            else {
                console.log(tl.loc("FailedToApplySpecialTransformation"));
            }          
        }
    }

    if(variableSubstitutionFileFormat === "xml") {
        let isSubstitutionApplied: boolean = true;
        if(targetFiles.length == 0) { 
            isSubstitutionApplied = xmlSubstitutionUtility.substituteAppSettingsVariables(folderPath, isFolderBasedDeployment);
        }
        else {            
            targetFiles.forEach(function(fileName) { 
                isSubstitutionApplied = xmlSubstitutionUtility.substituteAppSettingsVariables(folderPath, isFolderBasedDeployment, fileName) || isSubstitutionApplied;
            });
        }

        if(isSubstitutionApplied) {
            console.log(tl.loc('XMLvariablesubstitutionappliedsuccessfully')); 
        } 
        else {
            tl.error(tl.loc('FailedToApplyXMLvariablesubstitution'));
        }

    }

    if(variableSubstitutionFileFormat === "json") {
        // For Json variable substitution if no target files are specified file files matching **\*.json
        if(!targetFiles || targetFiles.length == 0) {
            targetFiles = ["**/*.json"];
        }
        let isSubstitutionApplied = jsonSubstitutionUtility.jsonVariableSubstitution(folderPath, targetFiles, true);
        if(isSubstitutionApplied) {
            console.log(tl.loc('JSONvariablesubstitutionappliedsuccessfully')); 
        } 
        else {
            tl.error(tl.loc('FailedToApplyJSONvariablesubstitution'));
        }
        
    }
}

export function enhancedFileTransformations(isFolderBasedDeployment: boolean, xmlTransformation: boolean, folderPath: string, transformationRules: any, xmlTargetFiles: any, jsonTargetFiles: any, failNoTransformation: boolean) {

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
                if(failNoTransformation) {
                    tl.error(tl.loc('FailedToApplySpecialTransformationReason1'));
                }
                else {
                    console.log(tl.loc("FailedToApplySpecialTransformation"));
                }
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
            if(failNoTransformation) {
                tl.error(tl.loc('FailedToApplyXMLvariablesubstitutionReason1'));
            }
            else {
                tl.error(tl.loc('FailedToApplyXMLvariablesubstitution')); 
            }
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
            if(failNoTransformation) {
                tl.error(tl.loc('FailedToApplyJSONvariablesubstitutionReason1'));
            }
            else {
                tl.error(tl.loc('FailedToApplyJSONvariablesubstitution'));  
            }
        }
    }
}