import tl = require('azure-pipelines-task-lib/task');
import trm = require('azure-pipelines-task-lib/toolrunner');
import path = require('path');

export function expandWildcardPattern(folderPath: string, wildcardPattern : string) {
    var matchingFiles = tl.findMatch(folderPath, wildcardPattern,   { followSymbolicLinks: false, allowBrokenSymbolicLinks: false, followSpecifiedSymbolicLink: false });
    var filesList = {};
    for (let i = 0; i < matchingFiles.length; i++) {
        matchingFiles[i] = matchingFiles[i].replace(/\//g, '\\');
        filesList[matchingFiles[i].toLowerCase()] = matchingFiles[i];
    }

    return filesList;
}

/**
* Applys XDT transform on Source file using the Transform file
*
* @param    sourceFile Source Xml File
* @param    tansformFile Transform Xml File
*
*/
export function applyXdtTransformation(sourceFile: string, transformFile: string, destinationFile?: string) {

    var cttPath = path.join(__dirname, "..", "..", "ctt", "ctt.exe"); 
    var cttArgsArray= [
        "s:" + sourceFile,
        "t:" + transformFile,
        "d:" + (destinationFile ? destinationFile : sourceFile),
        "pw",
        "i",
        "verbose"
    ];
    
    tl.debug("Running command: " + cttPath + ' ' + cttArgsArray.join(' '));
    var cttExecutionResult = tl.execSync(cttPath, cttArgsArray);
    if(cttExecutionResult.stderr) {
        throw new Error(tl.loc("XdtTransformationErrorWhileTransforming", sourceFile, transformFile));
    }
}

/**
* Performs XDT transformations on *.config using ctt.exe
*
* @param    sourcePattern  The source wildcard pattern on which the transforms need to be applied
* @param    transformConfigs  The array of transform config names, ex : ["Release.config", "EnvName.config"]
* 
*/
export function basicXdtTransformation(rootFolder, transformConfigs): boolean {
    var sourceXmlFiles = expandWildcardPattern(rootFolder, '**/*.config');
    var isTransformationApplied = false;
    Object.keys(sourceXmlFiles).forEach( function(sourceXmlFile) {
        sourceXmlFile = sourceXmlFiles[sourceXmlFile];
        var sourceBasename = path.win32.basename(sourceXmlFile.replace(/\.config/ig,'\.config'), ".config");    
        transformConfigs.forEach( function(transformConfig) {
            var transformXmlFile = path.join(path.dirname(sourceXmlFile), sourceBasename + "." + transformConfig);
            if(sourceXmlFiles[transformXmlFile.toLowerCase()]) {
                tl.debug('Applying XDT Transformation : ' + transformXmlFile + ' -> ' + sourceXmlFile);
                applyXdtTransformation(sourceXmlFile, transformXmlFile);
                isTransformationApplied = true;
            }
        });
    });
    if(!isTransformationApplied) {
        tl.warning(tl.loc('FailedToApplyTransformation'));
        tl.warning(tl.loc('FailedToApplyTransformationReason1'));
        tl.warning(tl.loc('FailedToApplyTransformationReason2'));
    }

    return isTransformationApplied;
}


/**
* Performs XDT transformations using ctt.exe
* 
*/
export function specialXdtTransformation(rootFolder, transformConfig, sourceConfig, destinationConfig?: string): boolean {
    var sourceXmlFiles = expandWildcardPattern(rootFolder, sourceConfig);
    var isTransformationApplied = false;

    for(var sourceXmlFile in sourceXmlFiles) {
        sourceXmlFile = sourceXmlFiles[sourceXmlFile];        
        var sourceBasename = "", transformXmlFiles = {};

        if(sourceConfig.indexOf("*") != -1){
            var sourceConfigSuffix = sourceConfig.substr(sourceConfig.lastIndexOf("*") + 1);
            if(sourceConfigSuffix.indexOf("\\") != -1) {
                sourceConfigSuffix = sourceConfigSuffix.substr(sourceConfigSuffix.lastIndexOf("\\") + 1);
            }
            sourceBasename = path.win32.basename(sourceXmlFile.replace(/\.config/ig,'\.config'), sourceConfigSuffix);
            if(JSON.stringify(sourceBasename) == JSON.stringify(sourceConfigSuffix)) {
                sourceBasename = "";
            }
        }

        if(transformConfig.indexOf("*") != -1){
            if(sourceBasename) {
                var transformConfigSuffix = transformConfig.substr(transformConfig.lastIndexOf("*") + 1);
                if(transformConfigSuffix.indexOf("\\") != -1) {
                    transformConfigSuffix = transformConfigSuffix.substr(transformConfigSuffix.lastIndexOf("\\") + 1);
                }
                var transformXmlFile = path.join(path.dirname(sourceXmlFile), sourceBasename + transformConfigSuffix);
                transformXmlFiles[transformXmlFile.toLowerCase()] = transformXmlFile;
            }
            else { 
                var transformXmlFiles = expandWildcardPattern(rootFolder, transformConfig);
            }
        }
        else {
            transformXmlFile = path.join(rootFolder, transformConfig);
            transformXmlFiles[transformXmlFile.toLowerCase()] = transformXmlFile;
        }

        var destinationXmlFile = "";
        if(destinationConfig){
            if(destinationConfig.indexOf("*") != -1){
                var destinationConfigSuffix = destinationConfig.substr(destinationConfig.lastIndexOf("*") + 1);
                destinationXmlFile = path.join(path.dirname(sourceXmlFile), sourceBasename + destinationConfigSuffix);
            }
            else {
                destinationXmlFile = path.join(rootFolder, destinationConfig);
            }    
        }
        
        for(var transformXmlFile in transformXmlFiles) {                
            if(sourceXmlFiles[transformXmlFile.toLowerCase()] || tl.exist(transformXmlFile)) {
                console.log(tl.loc('ApplyingXDTtransformation' , transformXmlFile , sourceXmlFile));
                applyXdtTransformation(sourceXmlFile, transformXmlFile, destinationXmlFile);
                isTransformationApplied = true;
            }
        }
    }

    return isTransformationApplied;
}