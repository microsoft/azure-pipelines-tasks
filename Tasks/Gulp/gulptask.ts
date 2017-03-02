/// <reference path="typings/index.d.ts" />

import path = require('path');
import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');

async function executeTask() {
	tl.setResourcePath(path.join(__dirname, 'task.json'));
	var gulpFilePath = tl.getPathInput('gulpFile', true, false);
	var gulp = tl.which('gulp', false);
	var isCodeCoverageEnabled = tl.getBoolInput('enableCodeCoverage');
	var publishJUnitResults = tl.getBoolInput('publishJUnitResults');
	var testResultsFiles = tl.getInput('testResultsFiles', publishJUnitResults);
	var cwd = tl.getPathInput('cwd', true, false);
	tl.mkdirP(cwd);
	tl.cd(cwd);

	tl.debug('check path : ' + gulp);
	if (!tl.exist(gulp)) {
		tl.debug('not found global installed gulp, try to find gulp locally.');
		var gt = tl.tool(tl.which('node', true));
		var gulpjs = tl.getInput('gulpjs', true);
		gulpjs = path.resolve(cwd, gulpjs);
		tl.debug('check path : ' + gulpjs);
		if (!tl.exist(gulpjs)) {
			tl.setResult(tl.TaskResult.Failed, tl.loc('GulpNotInstalled', gulpjs));
			return;
		}
		gt.arg(gulpjs);
	}
	else {
		var gt = tl.tool(gulp);
	}

	if (isCodeCoverageEnabled) {
		var npm = tl.tool(tl.which('npm', true));
		npm.line('install istanbul');
		var testFramework = tl.getInput('testFramework', true);
		var srcFiles = tl.getInput('srcFiles', false);
		var testSrc = tl.getPathInput('testFiles', true, false);
		var istanbul = tl.tool(tl.which('node', true));
		istanbul.arg('./node_modules/istanbul/lib/cli.js');
		istanbul.line('cover --report cobertura --report html');
		if (srcFiles) {
			istanbul.line('-i .' + path.sep + path.join(srcFiles));
		}
		if (testFramework.toLowerCase() == 'jasmine') {
			istanbul.line('./node_modules/jasmine/bin/jasmine.js JASMINE_CONFIG_PATH=node_modules/jasmine/lib/examples/jasmine.json');
		} else {
			istanbul.arg('./node_modules/mocha/bin/_mocha');
		}
		istanbul.arg(testSrc);
		var summaryFile = path.join(cwd, 'coverage/cobertura-coverage.xml');
		var reportDirectory = path.join(cwd, 'coverage/');
	}

	// optional - no targets will concat nothing
	gt.arg(tl.getDelimitedInput('targets', ' ', false));
	gt.arg('--gulpfile');

	//temp path to gulpfile.js, it will get overridden later
	gt.arg("temp/gulpfile.js");
	gt.line(tl.getInput('arguments', false));

	for (var gulpFile of getGulpFiles(gulpFilePath)) {
		substituteGulpFilePath(gt, gulpFile);
		await gt.exec().then(function (code) {
			publishTestResults(publishJUnitResults, testResultsFiles);
			if (isCodeCoverageEnabled) {
				return npm.exec().then(function () {
					return istanbul.exec().then(function (code) {
						publishCodeCoverage(summaryFile, reportDirectory);
						console.log(tl.loc('GulpReturnCode', code));
					}, function (err) {
						publishCodeCoverage(summaryFile, reportDirectory);
						tl.debug('taskRunner fail');
						throw new Error(tl.loc('IstanbulFailed', err.message));
					})
				}, function (err) {
					tl.debug('taskRunner fail');
					throw new Error(tl.loc('NpmFailed', err.message));
				})
			}
			else {
				console.log(tl.loc('GulpReturnCode', code));
			}
		}, function (err) {
			publishTestResults(publishJUnitResults, testResultsFiles);
			tl.debug('taskRunner fail');
			throw new Error(tl.loc('GulpFailed', err.message));
		})
	}
}

function publishTestResults(publishJUnitResults, testResultsFiles: string) {
	if (publishJUnitResults) {
		//check for pattern in testResultsFiles
		if (testResultsFiles.indexOf('*') >= 0 || testResultsFiles.indexOf('?') >= 0) {
			tl.debug('Pattern found in testResultsFiles parameter');
			var buildFolder = tl.getVariable('System.DefaultWorkingDirectory');
			var allFiles = tl.find(buildFolder);
			var matchingTestResultsFiles = tl.match(allFiles, testResultsFiles, "", { matchBase: true });
		}
		else {
			tl.debug('No pattern found in testResultsFiles parameter');
			var matchingTestResultsFiles = [testResultsFiles];
		}
		if (!matchingTestResultsFiles || matchingTestResultsFiles.length == 0) {
			tl.warning('No test result files matching ' + testResultsFiles + ' were found, so publishing JUnit test results is being skipped.');
			return 0;
		}
		var tp = new tl.TestPublisher("JUnit");
		try {
			tp.publish(matchingTestResultsFiles, true, "", "", "", true);
		} catch (error) {
			tl.warning(error);
		}
	}
}

function publishCodeCoverage(summaryFile, reportDirectory) {
	try {
		var ccPublisher = new tl.CodeCoveragePublisher();
		ccPublisher.publish('cobertura', summaryFile, reportDirectory, "");
	} catch (error) {
		tl.warning(error);
		throw error;
	}
}

function getGulpFiles(gulpFilePath: string): string[] {
	var gulpFiles = [];

	if (/[\*?+@!{}\[\]]/.test(gulpFilePath)) {
		gulpFiles = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory"), gulpFilePath);
		tl.debug("number of files matching filePath: " + gulpFiles.length);
		if(gulpFiles.length === 0) {
			tl.warning(tl.loc('NoGulpFileFound', gulpFilePath));
		}
	}
	else {
		tl.checkPath(gulpFilePath, "gulpfile");
		gulpFiles.push(gulpFilePath);
	}
	return gulpFiles;
}

function substituteGulpFilePath(gt: trm.ToolRunner, filePath: string) {
	var indexOfGulpFile = gt.args.indexOf("--gulpfile");
	if (indexOfGulpFile >= 0) {
		gt.args[indexOfGulpFile + 1] = filePath;
	}
}

executeTask().catch((error) => tl.setResult(tl.TaskResult.Failed, error));