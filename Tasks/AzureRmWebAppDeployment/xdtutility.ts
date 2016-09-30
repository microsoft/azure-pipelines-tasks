import path = require('path');
import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');

function applyXmlTransformation(sourceFile, transformFile) {
	var cttPath = path.join(__dirname, 'ctt/ctt.exe');
    var cttArgs = ' s:"' + sourceFile + '" t:"' + transformFile + '" d:"' + sourceFile + '" pw';
    var cttExecutionResult = tl.execSync(cttPath, cttArgs, <trm.IExecOptions>{failOnStdErr: true, silent: true});
    if(cttExecutionResult.stderr)
        throw "XML Transformation Error while transforming " + sourceFile + " using " + transformFile;
}

export function xmlTransform(transformXmlPattern : string, sourceXmlPattern : string) {
	var transformXmlFiles = expandWildcardPattern (transformXmlPattern);
	var sourceXmlFiles = expandWildcardPattern (sourceXmlPattern);

	var transformXmlPatternBaseName = getPatternBaseName (transformXmlPattern);
	var sourceXmlPatternBaseName = getPatternBaseName (sourceXmlPattern);

	Object.keys(sourceXmlFiles).forEach(function(xmlFile) {
		var transformXmlFile = path.join(path.dirname(xmlFile), path.basename(xmlFile, sourceXmlPatternBaseName) + transformXmlPatternBaseName);
		if (transformXmlFiles[transformXmlFile]) {
			tl._writeLine('Applying XML Transformation : ' + transformXmlFile + '->' + xmlFile);
			applyXmlTransformation(xmlFile, transformXmlFile);
		}
	});
}

function getPatternBaseName (filePattern : string) : string {
	// returns the substring from the last found wildcard character to the end of the filePattern string
	var fileBaseName = path.basename(filePattern);
	var wildcardChars = '?_*%#]';
	for (var i = fileBaseName.length - 1; i >= 0; i--) {
		if (wildcardChars.indexOf(fileBaseName[i]) >= 0) {
			fileBaseName = fileBaseName.substr(i + 1) ;
		}
	}
	return fileBaseName;
}

function expandWildcardPattern (wildcardPattern : string) {
	var matchingFiles = tl.glob(wildcardPattern);
	var xmlFiles = {};
	for (var i = 0; i < matchingFiles.length; i++) 
		xmlFiles[path.resolve(matchingFiles[i])] = true;

	return xmlFiles;
}