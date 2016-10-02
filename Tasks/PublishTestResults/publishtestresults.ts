import tl = require('vsts-task-lib/task');
import path = require('path');

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

var matchingTestResultsFiles: string[] = getMatchingFiles(tl.getVariable('System.DefaultWorkingDirectory'), testResultsFiles, 'testResultsFiles');

if (!matchingTestResultsFiles || matchingTestResultsFiles.length == 0) {
  tl.warning('No test result files matching ' + testResultsFiles + ' were found.');
  tl.exit(0);
}
else {
  var tp = new tl.TestPublisher(testRunner);
  tp.publish(matchingTestResultsFiles, mergeResults, platform, config, testRunTitle, publishRunAttachments);
}

function getMatchingFiles(baseDirectory: string, inputPattern: string, inputPatternName: string): string[] {
  var matchingFiles: string[] = [];
  var indexOfAst: number = inputPattern.indexOf('*');
  var indexOfQues: number = inputPattern.indexOf('?');
  var basePath: string = baseDirectory;

  if (indexOfAst >= 0 || indexOfQues >= 0) {
    tl.debug('Pattern found in ' + inputPatternName + ' parameter');
    if (path.isAbsolute(inputPattern)) {
      indexOfAst = indexOfAst >= 0 ? indexOfAst : inputPattern.length;
      indexOfQues = indexOfQues >= 0 ? indexOfQues : inputPattern.length;

      var minIndexRegex: number = Math.min(indexOfAst, indexOfQues);
      var lastIndexPathSep: number = inputPattern.lastIndexOf(path.sep, minIndexRegex);
      basePath = inputPattern.substring(0, lastIndexPathSep);

      tl.debug("Updating search base path to: " + basePath);
    }

    tl.debug("Using base path for matching files: " + basePath);
    matchingFiles = tl.match(tl.find(basePath), inputPattern, { matchBase: true });
  }
  else {
    tl.debug('No pattern found in ' + inputPatternName + ' parameter');
    matchingFiles = [inputPattern];
  }
  return matchingFiles;
}