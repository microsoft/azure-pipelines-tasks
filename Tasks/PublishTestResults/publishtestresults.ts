/// <reference path="../../definitions/vsts-task-lib.d.ts" />

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

var matchingTestResultsFiles = [];
//check for pattern in testResultsFiles
if(testResultsFiles.indexOf('*') >= 0 || testResultsFiles.indexOf('?') >= 0) {
  tl.debug('Pattern found in testResultsFiles parameter');
      if (path.isAbsolute(testResultsFiles)) {
        var pathParts = testResultsFiles.split(path.sep);
        var basePath = "";
        var part= "";
        for (part in pathParts) {
            if (isRegexPath(pathParts[part]) == false) {
                basePath += pathParts[part] + path.sep;
            }
        }
        matchingTestResultsFiles = matchFiles(basePath, testResultsFiles);
    } else {
        matchingTestResultsFiles = matchFiles(tl.getVariable('System.DefaultWorkingDirectory'), testResultsFiles);
    }
}
else {
  tl.debug('No pattern found in testResultsFiles parameter');
  matchingTestResultsFiles = [testResultsFiles];
}

if(!matchingTestResultsFiles || matchingTestResultsFiles.length == 0) {
  tl.warning('No test result files matching ' + testResultsFiles + ' were found.');  
  tl.exit(0);
}
else{
  var tp = new tl.TestPublisher(testRunner);
  tp.publish(matchingTestResultsFiles, mergeResults, platform, config, testRunTitle, publishRunAttachments);
}

function isRegexPath(filePath: string): boolean {
    return (filePath.indexOf('*') >= 0 || filePath.indexOf('?') >= 0);
}

function matchFiles(basePath: string, filePattern: string): string[] {
    tl.debug("Base path for matching files: " + basePath);
    var allFiles = tl.find(basePath);
    return tl.match(allFiles, filePattern, { matchBase: true });
}