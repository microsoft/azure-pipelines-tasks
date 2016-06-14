/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import tl = require('vsts-task-lib/task');
import fs = require('fs');
import os = require('os');

tl.setResourcePath(path.join( __dirname, 'task.json'));

var gulpFile = tl.getPathInput('gulpFile', true, true);

var cwd = tl.getPathInput('cwd', true, false);
tl.mkdirP(cwd);
tl.cd(cwd);

var npm = tl.createToolRunner(tl.which('npm', true));
npm.arg('install');
npm.arg('istanbul');


var gulp = tl.which('gulp', false);

tl.debug('check path : ' + gulp);
if(!tl.exist(gulp)) {
	tl.debug('not found global installed gulp, try to find gulp locally.');
	var gt = tl.createToolRunner(tl.which('node', true));

	var gulpjs = tl.getInput('gulpjs', true);
	gulpjs = path.resolve(cwd, gulpjs);

	tl.debug('check path : ' + gulpjs);
	if(!tl.exist(gulpjs)) {
		tl.setResult(tl.TaskResult.Failed, tl.loc('GulpNotInstalled', gulpjs));
	}

	gt.pathArg(gulpjs);
}
else {
	var gt = tl.createToolRunner(gulp);
}

// optional - no targets will concat nothing
gt.arg(tl.getDelimitedInput('targets', ' ', false));

var enableCoverage = tl.getBoolInput('enableCodeCoverage');

if(enableCoverage){
	var testSrc = tl.getPathInput('testFiles', true, false);
	
	if(os.type().match(/^Win/)){
		var istanbul = tl.createToolRunner(tl.which('istanbul', true));
	}else{
		var istanbul = tl.createToolRunner(tl.which('./node_modules/istanbul/lib/cli.js', true));
	}
	
	istanbul.argString('cover --report cobertura');
	istanbul.arg('./node_modules/mocha/bin/_mocha');
	istanbul.arg(testSrc);
	istanbul.argString('-- --ui bdd -t 5000');
	
	var buildFolder = tl.getVariable('System.DefaultWorkingDirectory');

	var summaryFile = path.join(buildFolder,'coverage/cobertura-coverage.xml');
}

gt.arg('--gulpfile');

gt.pathArg(gulpFile);

gt.argString(tl.getInput('arguments', false));

var publishJUnitResults = tl.getBoolInput('publishJUnitResults');
var testResultsFiles = tl.getInput('testResultsFiles', publishJUnitResults);

npm.exec().then(function(){
gt.exec()
.then(function(code) {
	if(enableCoverage){
		istanbul.exec().then(function(code){
			publishTestResults(publishJUnitResults, testResultsFiles);
			publishCodeCoverage(summaryFile);
			tl.setResult(tl.TaskResult.Succeeded, tl.loc('GulpReturnCode', code));
		})
		.fail(function(err){
			publishTestResults(publishJUnitResults, testResultsFiles);
			tl.debug('taskRunner fail');
			tl.setResult(tl.TaskResult.Failed, tl.loc('IstanbulFailed', err.message));
		});
	}else{
		publishTestResults(publishJUnitResults, testResultsFiles);
		tl.setResult(tl.TaskResult.Succeeded, tl.loc('GulpReturnCode', code));
	}
	
})
.fail(function(err) {
	publishTestResults(publishJUnitResults, testResultsFiles);
	tl.debug('taskRunner fail');
	tl.setResult(tl.TaskResult.Failed, tl.loc('GulpFailed', err.message));
})
}).fail(function(err){
	tl.debug('taskRunner fail');
	tl.setResult(tl.TaskResult.Failed, tl.loc('NpmFailed', err.message));
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

function publishCodeCoverage(summaryFile){
	var ccPublisher = new tl.CodeCoveragePublisher();
	ccPublisher.publish('cobertura', summaryFile,"","");
}