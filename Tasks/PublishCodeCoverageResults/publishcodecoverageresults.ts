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

if(additionalCodeCoverageFiles && (additionalCodeCoverageFiles.indexOf('*') >= 0 || additionalCodeCoverageFiles.indexOf('?') >= 0)) {
  var buildFolder = tl.getVariable('agent.buildDirectory');
  var allFiles = tl.find(buildFolder);
  var codeCoverageFiles = tl.match(allFiles, additionalCodeCoverageFiles, { matchBase: true });
}
else if(additionalCodeCoverageFiles) {
  var  codeCoverageFiles = [additionalCodeCoverageFiles];
}

var ccp = new tl.CodeCoveragePublisher();
ccp.publish(codeCoverageTool, summaryFileLocation, reportDirectory, codeCoverageFiles);