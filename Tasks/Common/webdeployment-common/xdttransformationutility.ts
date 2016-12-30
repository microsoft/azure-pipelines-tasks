import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');
import path = require('path');

export function expandWildcardPattern(folderPath: string, wildcardPattern : string) {
    var matchingFiles = tl.findMatch(folderPath, wildcardPattern);
    var filesList = {};
    for (let i = 0; i < matchingFiles.length; i++) {
        matchingFiles[i] = matchingFiles[i].replace(/\//g, '\\');
        filesList[matchingFiles[i].toLowerCase()] = true;
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
    var cttBatchFile = tl.getVariable('System.DefaultWorkingDirectory') + '\\' + 'cttCommand.bat';
    var cttPath = path.join(__dirname, "..", "..", "ctt", "ctt.exe"); 
    var cttArgs = ' s:"' + sourceFile + '" t:"' + transformFile + '" d:"' + sourceFile + '" pw';
    var cttCommand = '"' + cttPath + '" ' + cttArgs + '\n';
    tl.writeFile(cttBatchFile, cttCommand);
    tl.debug("Running command" + cttCommand);
    var cttExecutionResult = tl.execSync("cmd", ['/C', cttBatchFile]);
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
export function basicXdtTransformation(rootFolder, transformConfigs) {
    var sourceXmlFiles = expandWildcardPattern(rootFolder, '**/*.config');
    Object.keys(sourceXmlFiles).forEach( function(sourceXmlFile) {
        var sourceBasename = path.win32.basename(sourceXmlFile, ".config");    
        transformConfigs.forEach( function(transformConfig) {
            var transformXmlFile = path.join(path.dirname(sourceXmlFile), sourceBasename + "." + transformConfig);
            if(sourceXmlFiles[transformXmlFile.toLowerCase()]) {
                tl.debug('Applying XDT Transformation : ' + transformXmlFile + '->' + sourceXmlFile);
                applyXdtTransformation(sourceXmlFile, transformXmlFile);
            }
        });
    });    
}