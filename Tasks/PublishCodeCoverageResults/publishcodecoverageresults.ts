/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import tl = require('vsts-task-lib/task');

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
catch
{
	tl.error("Code coverage publisher not found. Latest agent is required");
	throw;
}
tp.publish(codeCoverageTool, summaryFileLocation, reportDirectory, codeCoverageFiles);