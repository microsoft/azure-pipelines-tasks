import tl = require('azure-pipelines-task-lib/task');
import ffl = require('./find-files-legacy');

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

let workingDirectory = tl.getVariable('System.DefaultWorkingDirectory');
let matchingTestResultsFiles = process.platform === 'win32' ?
  ffl.findWindowsFiles(testResultsFiles, workingDirectory) :
  ffl.findFiles(testResultsFiles, false, workingDirectory);
if(!matchingTestResultsFiles || matchingTestResultsFiles.length == 0) {
  tl.warning('No test result files matching ' + testResultsFiles + ' were found.');
}
else{
  let tp = new tl.TestPublisher(testRunner);
  tp.publish(matchingTestResultsFiles, mergeResults, platform, config, testRunTitle, publishRunAttachments,
    process.platform === 'win32' ? 'VSTS - PTR' : undefined);
}

tl.setResult(tl.TaskResult.Succeeded, '');