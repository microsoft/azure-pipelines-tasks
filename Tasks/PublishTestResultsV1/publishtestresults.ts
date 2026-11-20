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
let taskResult = tl.TaskResult.Succeeded;
let taskResultMessage = '';
if(!matchingTestResultsFiles || matchingTestResultsFiles.length == 0) {
  tl.warning('No test result files matching ' + testResultsFiles + ' were found.');
}
else{
  let hasCommaPath = matchingTestResultsFiles.some(file => file.indexOf(',') >= 0);
  let supportsStructuredResultFiles = (tl.getVariable('Agent.Features.ResultsPublishStructuredFiles') || '').toLowerCase() === 'true';
  if (hasCommaPath && !supportsStructuredResultFiles) {
    taskResult = tl.TaskResult.Failed;
    taskResultMessage = 'Publishing test results from paths containing commas requires an updated Azure Pipelines agent.';
  } else if (hasCommaPath) {
    tl.command('results.publish', {
      type: testRunner,
      mergeResults: mergeResults,
      platform: platform,
      config: config,
      runTitle: testRunTitle,
      publishRunAttachments: publishRunAttachments,
      resultFiles: matchingTestResultsFiles.join(','),
      resultFilesJson: JSON.stringify(matchingTestResultsFiles),
      testRunSystem: process.platform === 'win32' ? 'VSTS - PTR' : 'VSTSTask'
    }, '');
  } else {
    let tp = new tl.TestPublisher(testRunner);
    tp.publish(matchingTestResultsFiles, mergeResults, platform, config, testRunTitle, publishRunAttachments,
      process.platform === 'win32' ? 'VSTS - PTR' : undefined);
  }
}

tl.setResult(taskResult, taskResultMessage);