/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import tl = require('vsts-task-lib/task');
import path = require('path');

tl.setResourcePath(path.join(__dirname, 'task.json'));

var codeCoverageTool = tl.getInput('codeCoverageTool', true);
var summaryFileLocation = tl.getInput('summaryFileLocation', true);
var reportDirectory = tl.getInput('reportDirectory');
var additionalCodeCoverageFiles = tl.getInput('additionalCodeCoverageFiles');

tl.debug('codeCoverageTool: ' + codeCoverageTool);
tl.debug('summaryFileLocation: ' + summaryFileLocation);
tl.debug('reportDirectory: ' + reportDirectory);
tl.debug('additionalCodeCoverageFiles: ' + additionalCodeCoverageFiles);

if(additionalCodeCoverageFiles)
{
  var buildFolder = tl.getVariable('agent.buildDirectory');
  var allFiles = tl.find(buildFolder);
  var codeCoverageFiles = tl.match(allFiles, additionalCodeCoverageFiles, { matchBase: true });
}

try
{
	var tp = new tl.CodeCoveragePublisher();
}
catch (ex)
{
	tl.error(tl.loc('PublishCodeCoverageResultsCommandNotFound'));
	throw ex;
}
tp.publish(codeCoverageTool, summaryFileLocation, reportDirectory, codeCoverageFiles);