/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import tl = require('vsts-task-lib/task');

var testRunner = tl.getInput('testRunner', true);
var testResultsFiles = tl.getInput('testResultsFiles', true);
var mergeResults = tl.getInput('mergeTestResults');
var platform = tl.getInput('platform');
var config = tl.getInput('configuration');
var testRunTitle = tl.getInput('testRunTitle');
var publishRunAttachments = tl.getInput('publishRunAttachments');

tl.debug('testRunner: ' + testRunner);
tl.debug('testResultsFiles: ' + testResultsFiles);
tl.debug('mergeResults: ' + mergeResults);
tl.debug('platform: ' + platform);
tl.debug('config: ' + config);
tl.debug('testRunTitle: ' + testRunTitle);
tl.debug('publishRunAttachments: ' + publishRunAttachments);

//check for pattern in testResultsFiles
if(testResultsFiles.indexOf('*') >= 0 || testResultsFiles.indexOf('?') >= 0) {
  tl.debug('Pattern found in testResultsFiles parameter');
  var buildFolder = tl.getVariable('agent.buildDirectory');
  var allFiles = tl.find(buildFolder);
  var matchingTestResultsFiles = tl.match(allFiles, testResultsFiles, { matchBase: true });
}
else {
  tl.debug('No pattern found in testResultsFiles parameter');
  var matchingTestResultsFiles = [testResultsFiles];
}

if(!matchingTestResultsFiles || matchingTestResultsFiles.length == 0) {
  tl.warning('No test result files matching ' + testResultsFiles + ' were found.');  
  tl.exit(0);
}
else{
  var tp = new tl.TestPublisher(testRunner);
  tp.publish(matchingTestResultsFiles, mergeResults, platform, config, testRunTitle, publishRunAttachments);
}