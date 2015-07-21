var tl = require('vso-task-lib');

var testRunner = tl.getInput('testRunner', true);
var testResultsFiles = tl.getInput('testResultsFiles', true);
var mergeResults = tl.getInput('mergeTestResults');
var platform = tl.getInput('platform');
var config = tl.getInput('configuration');

tl.debug('testRunner: ' + testRunner);
tl.debug('testResultsFiles: ' + testResultsFiles);
tl.debug('mergeResults: ' + mergeResults);
tl.debug('platform: ' + platform);
tl.debug('config: ' + config);

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

if(!matchingTestResultsFiles) {
  tl.warning('No test result files matching ' + testResultsFiles + ' were found.');  
  tl.exit(0);
}

var tp = new tl.TestPublisher(testRunner);
tp.publish(matchingTestResultsFiles, mergeResults, platform, config);