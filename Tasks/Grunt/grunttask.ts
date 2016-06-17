/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import tl = require('vsts-task-lib/task');
import fs = require('fs');
import os = require('os');

tl.setResourcePath(path.join(__dirname, 'task.json'));

var gruntFile = tl.getPathInput('gruntFile', true, true);
var grunt = tl.which('grunt', false);
var isCodeCoverageEnabled = tl.getBoolInput('enableCodeCoverage');
var publishJUnitResults = tl.getBoolInput('publishJUnitResults');
var testResultsFiles = tl.getInput('testResultsFiles', publishJUnitResults);
var cwd = tl.getPathInput('cwd', true, false);
tl.mkdirP(cwd);
tl.cd(cwd);

tl.debug('check path : ' + grunt);
if (!tl.exist(grunt)) {
	tl.debug('not found global installed grunt-cli, try to find grunt-cli locally.');
	var gt = tl.createToolRunner(tl.which('node', true));
	var gtcli = tl.getInput('gruntCli', true);
	gtcli = path.resolve(cwd, gtcli);
	tl.debug('check path : ' + gtcli);
	if (!tl.exist(gtcli)) {
		tl.setResult(tl.TaskResult.Failed, tl.loc('GruntCliNotInstalled', gtcli));
	}
	gt.pathArg(gtcli);
}
else {
	var gt = tl.createToolRunner(grunt);
}

if (isCodeCoverageEnabled) {
	var npm = tl.createToolRunner(tl.which('npm', true));
	npm.argString('install istanbul');
	var testFramework = tl.getInput('testFramework', true);
	var testSrc = tl.getPathInput('testFiles', true, false);
	var istanbul = tl.createToolRunner(tl.which('node', true));
	istanbul.arg('./node_modules/istanbul/lib/cli.js');
	istanbul.argString('cover --report cobertura --report html');
	if (testFramework.toLowerCase() == 'jasmine') {
		var jasmineInit = tl.createToolRunner(tl.which('node', true));
		jasmineInit.argString('./node_modules/jasmine/bin/jasmine.js init');
		istanbul.arg('./node_modules/jasmine/bin/jasmine.js');
	} else {
		istanbul.arg('./node_modules/mocha/bin/_mocha');
	}
	istanbul.arg(testSrc);
	var buildFolder = tl.getVariable('System.DefaultWorkingDirectory');
	var summaryFile = path.join(buildFolder, 'coverage/cobertura-coverage.xml');
	var reportDirectory = path.join(buildFolder, 'coverage/');
}

// optional - no targets will concat nothing
gt.arg(tl.getDelimitedInput('targets', ' ', false));
gt.arg('--gruntfile');
gt.pathArg(gruntFile);
gt.argString(tl.getInput('arguments', false));
gt.exec().then(function (code) {
	publishTestResults(publishJUnitResults, testResultsFiles);
	if (isCodeCoverageEnabled) {
		npm.exec().then(function () {
			if (testFramework.toLowerCase() == 'jasmine') {
				jasmineInit.exec().then(function (code) {
					istanbul.exec().then(function (code) {
						publishCodeCoverage(summaryFile);
						tl.setResult(tl.TaskResult.Succeeded, tl.loc('GulpReturnCode', code));
					}).fail(function (err) {
						tl.debug('taskRunner fail');
						tl.setResult(tl.TaskResult.Failed, tl.loc('IstanbulFailed', err.message));
					});
				})
			} else {
				istanbul.exec().then(function (code) {
					publishCodeCoverage(summaryFile);
					tl.setResult(tl.TaskResult.Succeeded, tl.loc('GulpReturnCode', code));
				}).fail(function (err) {
					tl.debug('taskRunner fail');
					tl.setResult(tl.TaskResult.Failed, tl.loc('IstanbulFailed', err.message));
				});
			}
		}).fail(function (err) {
			tl.debug('taskRunner fail');
			tl.setResult(tl.TaskResult.Failed, tl.loc('NpmFailed', err.message));
		})
	} else {
		tl.setResult(tl.TaskResult.Succeeded, tl.loc('GruntReturnCode', code));
	}
}).fail(function (err) {
	publishTestResults(publishJUnitResults, testResultsFiles);
	tl.debug('taskRunner fail');
	tl.setResult(tl.TaskResult.Failed, tl.loc('GruntFailed', err.message));
})

function publishTestResults(publishJUnitResults, testResultsFiles: string) {
    if (publishJUnitResults) {
        //check for pattern in testResultsFiles
        if (testResultsFiles.indexOf('*') >= 0 || testResultsFiles.indexOf('?') >= 0) {
            tl.debug('Pattern found in testResultsFiles parameter');
            var buildFolder = tl.getVariable('System.DefaultWorkingDirectory');
            var allFiles = tl.find(buildFolder);
            var matchingTestResultsFiles = tl.match(allFiles, testResultsFiles, { matchBase: true });
        }
        else {
            tl.debug('No pattern found in testResultsFiles parameter');
            var matchingTestResultsFiles = [testResultsFiles];
        }
        if (!matchingTestResultsFiles) {
            tl.warning('No test result files matching ' + testResultsFiles + ' were found, so publishing JUnit test results is being skipped.');
            return 0;
        }
        var tp = new tl.TestPublisher("JUnit");
        tp.publish(matchingTestResultsFiles, true, "", "", "", true);
    }
}

function publishCodeCoverage(summaryFile) {
	var ccPublisher = new tl.CodeCoveragePublisher();
	ccPublisher.publish('cobertura', summaryFile, reportDirectory, "");
}