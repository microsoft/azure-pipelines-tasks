import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');
import path = require('path');

export function expandWildcardPattern(folderPath: string, wildcardPattern : string) {
    var matchingFiles = tl.findMatch(folderPath, wildcardPattern);
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
export function applyXdtTransformation(sourceFile, transformFile) {

    var cttPath = path.join(__dirname, "..", "..", "ctt", "ctt.exe"); 
    var cttArgsArray= [
        "s:" + sourceFile,
        "t:" + transformFile,
        "d:" + sourceFile,
        "pw",
        "i"
    ];
    
    var debugModeEnabled = tl.getVariable('system.debug');
    if(debugModeEnabled && debugModeEnabled.toLowerCase() == 'true') {
        cttArgsArray.push("verbose");
        tl.debug('Enabled debug mode for ctt.exe');
    }

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
        var sourceBasename = path.win32.basename(sourceXmlFile, ".config");    
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