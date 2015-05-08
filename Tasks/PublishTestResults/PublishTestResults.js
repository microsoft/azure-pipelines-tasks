var fs = require('fs');
var glob = require('glob');
var tl = require('vso-task-lib');

var testRunner = tl.getInput('testRunner', true);
var testResultsFiles = tl.getInput('testResultsFiles', true);
var mergeResults = tl.getInput('mergeTestResults');
var platform = tl.getInput('platform');
var config = tl.getInput('config');

tl.debug('testRunner: ' + testRunner);
tl.debug('testResultsFiles: ' + testResultsFiles);
tl.debug('mergeResults: ' + mergeResults);
tl.debug('platform: ' + platform);
tl.debug('config: ' + config);

var onError = function (errorMsg) {
  tl.error(errorMsg);
  tl.exit(1);
}

//check for pattern in testResultsFiles
if(testResultsFiles.indexOf('*') >= 0 || testResultsFiles.indexOf('?') >= 0) {
  tl.debug('Pattern found in testResultsFiles parameter');
  var matchingTestResultsFiles = glob.sync(testResultsFiles);
  tl.debug('matchingTestResultsFiles = ' + matchingTestResultsFiles);
}
else {
  tl.debug('No pattern found in testResultsFiles parameter');
  var matchingTestResultsFiles = [testResultsFiles];
}

if(!matchingTestResultsFiles) {
  onError('No test result files matching ' + testResultsFiles + ' were found.');  
}

var tp = new tl.TestPublisher(testRunner);
tp.publish(matchingTestResultsFiles, mergeResults, platform, config);