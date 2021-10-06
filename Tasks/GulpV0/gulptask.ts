import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
import minimatch = require('minimatch');

tl.setResourcePath(path.join(__dirname, 'task.json'));

var gulpFile = tl.getPathInput('gulpFile', true, true);
tl.debug('check gulp file :' + gulpFile);
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
gt.arg(['--gulpfile', gulpFile]);
gt.line(tl.getInput('arguments', false));
gt.exec().then(function (code) {
	publishTestResults(publishJUnitResults, testResultsFiles);
	if (isCodeCoverageEnabled) {
		npm.exec().then(function () {
			istanbul.exec().then(function (code) {
				publishCodeCoverage(summaryFile);
				tl.setResult(tl.TaskResult.Succeeded, tl.loc('GulpReturnCode', code));
			}).fail(function (err) {
				publishCodeCoverage(summaryFile);
				tl.debug('taskRunner fail');
				tl.setResult(tl.TaskResult.Failed, tl.loc('IstanbulFailed', err.message));
			});
		}).fail(function (err) {
			tl.debug('taskRunner fail');
			tl.setResult(tl.TaskResult.Failed, tl.loc('NpmFailed', err.message));
		})
	} else {
		tl.setResult(tl.TaskResult.Succeeded, tl.loc('GulpReturnCode', code));
	}
}).fail(function (err) {
	publishTestResults(publishJUnitResults, testResultsFiles);
	tl.debug('taskRunner fail');
	tl.setResult(tl.TaskResult.Failed, tl.loc('GulpFailed', err.message));
})

function publishTestResults(publishJUnitResults, testResultsFiles: string) {
    if (publishJUnitResults) {
        //check for pattern in testResultsFiles
        if (testResultsFiles.indexOf('*') >= 0 || testResultsFiles.indexOf('?') >= 0) {
            tl.debug('Pattern found in testResultsFiles parameter');
            var buildFolder = tl.getVariable('System.DefaultWorkingDirectory');
            var allFiles = tl.find(buildFolder);
            var matchingTestResultsFiles = minimatch.match(allFiles, testResultsFiles, { matchBase: true });
        }
        else {
            tl.debug('No pattern found in testResultsFiles parameter');
            var matchingTestResultsFiles = [testResultsFiles];
        }
        if (!matchingTestResultsFiles || matchingTestResultsFiles.length == 0) {
            tl.warning('No test result files matching ' + testResultsFiles + ' were found, so publishing JUnit test results is being skipped.');
            return 0;
        }
        var tp = new tl.TestPublisher("JUnit");
		try {
			tp.publish(matchingTestResultsFiles, 'true', "", "", "", 'true');
		} catch (error) {
			tl.warning(error);
		}
    }
}

function publishCodeCoverage(summaryFile) {
	try {
		var ccPublisher = new tl.CodeCoveragePublisher();
		ccPublisher.publish('cobertura', summaryFile, reportDirectory, "");
	} catch (error) {
		tl.warning(error);
		throw error;
	}
}