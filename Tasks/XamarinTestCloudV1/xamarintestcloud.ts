import fs = require('fs');
import path = require('path');
import os = require('os');
import minimatch = require('minimatch');
import tl = require('azure-pipelines-task-lib/task');

var isWin = /^win/.test(process.platform);

// Get inputs
var app = tl.getInput('app', true);
var dsym = tl.getInput('dsym', false);
var teamApiKey = tl.getInput('teamApiKey', true);
var user = tl.getInput('user', true);
var devices = tl.getInput('devices', true);
var series = tl.getInput('series', true);
var testDir = tl.getPathInput('testDir', true);
var parallelization = tl.getInput('parallelization', true);
var locale = tl.getInput('locale', true);
var userDefinedLocale = tl.getInput('userDefinedLocale', false);
var testCloudLocation = tl.getInput('testCloudLocation', true);
var optionalArgs = tl.getInput('optionalArgs', false);
var publishNUnitResults = tl.getInput('publishNUnitResults', false);

// Define error handler
var onError = function (errorMsg) {
    tl.error(errorMsg);

    // This code came from here: https://github.com/microsoft/azure-pipelines-task-lib/blob/releases/0.7/node/lib/task.ts 'exit(1)'
    tl.setResult(tl.TaskResult.Failed, tl.loc('LIB_ReturnCode', 1));
    process.exit(0);
}

function findFiles(pattern: string) : string [] {
    //set default matching options
    var matchOptions = {matchBase: true};

    // Resolve files for the specified value or pattern
    var filesList : string [];
    if (pattern.indexOf('*') == -1 && pattern.indexOf('?') == -1) {
        // No pattern found, check literal path to a single file
        tl.checkPath(pattern, 'files');

        // Use the specified single file
        filesList = [pattern];
    } else {
        var firstWildcardIndex = function(str) {
            var idx = str.indexOf('*');

            var idxOfWildcard = str.indexOf('?');
            if (idxOfWildcard > -1) {
                return (idx > -1) ?
                    Math.min(idx, idxOfWildcard) : idxOfWildcard;
            }

            return idx;
        }

        // First find the most complete path without any matching patterns
        var idx = firstWildcardIndex(pattern);
        tl.debug('Index of first wildcard: ' + idx);

        var findPathRoot = path.dirname(pattern.slice(0, idx));
        tl.debug('find root dir: ' + findPathRoot);

        // Now we get a list of all files under this root
        var allFiles = tl.find(findPathRoot);

        // Find files matching the specified pattern
        tl.debug('Matching glob pattern: ' + pattern);
        filesList = minimatch.match(allFiles, pattern, matchOptions);
    }
    return filesList;
}

// Resolve apps for the specified value or pattern
var appFiles;
if (app.indexOf('*') == -1 && app.indexOf('?') == -1) {
    // Check literal path to a single app file
    if (!tl.exist(app)) {
        onError('The specified app file does not exist: ' + app);
    }

    // Use the single specified app file
    appFiles = [app];
} else {
    appFiles = findFiles(app);

    // Fail if no matching app files were found
    if (!appFiles || appFiles.length == 0) {
        onError('No matching app files were found with search pattern: ' + app);
    }
}

// Check and add parameter for test assembly directory
if (!tl.exist(testDir)) {
    onError('The test assembly directory does not exist: ' + testDir);
}

// Ensure that $testCloudLocation specifies test-cloud.exe (case-sensitive)
if (path.basename(testCloudLocation) != 'test-cloud.exe') {
    tl.debug("testCloudLocation = " + testCloudLocation);
    onError("test-cloud.exe location must end with '\\test-cloud.exe'.");
}

// Locate test-cloud.exe (part of the Xamarin.UITest NuGet package)
var testCloud;
if (testCloudLocation.indexOf('*') == -1 && testCloudLocation.indexOf('?') == -1) {
    // Check literal path to test-cloud.exe
    if (!tl.exist(testCloudLocation)) {
        onError('test-cloud.exe does not exist at the specified location: ' + testCloudLocation);
    }

    // Use literal path to test-cloud.exe
    testCloud = testCloudLocation;
} else {
    var testCloudExecutables = findFiles(testCloudLocation);

    // Fail if no matching test-cloud.exe was found
    if (!testCloudExecutables || testCloudExecutables.length == 0) {
        onError('test-cloud.exe could not be found with search pattern ' + testCloudLocation);
    }

    //Use first found path to test-cloud.exe
    testCloud = testCloudExecutables[0];
}
tl.debug('test-cloud.exe location = ' + testCloud);

// Invoke test-cloud.exe for each app file
var buildId = tl.getVariable('build.buildId');
var appFileIndex = 0;
var runFailures;
var testCloudResults:string[] = [];

var onRunComplete = function () {
    appFileIndex++;

    if (appFileIndex >= appFiles.length) {
        publishTestResults();
        uploadTestSummary();

        if (runFailures == 'true') {
            tl.setResult(tl.TaskResult.Failed, "Xamarin Test Cloud runs had failures, check the log for details.")
        }
        else {
            tl.setResult(tl.TaskResult.Succeeded, "Xamarin Test Cloud runs completed successfully.");
        }
    } else {
        // Submit next app file
        submitToTestCloud(appFileIndex);
    }
}
var onFailedExecution = function (err) {
    runFailures = 'true';
    tl.setResult(tl.TaskResult.Failed, err);
    tl.debug('Error executing test run: ' + err);
    onRunComplete();
}

function uploadTestSummary() {
    tl.debug('Upload test cloud run results summary. testCloudResults = ' + testCloudResults);

    //create a .md file
    var mdReportFile = path.join(testDir, '/xamarintestcloud_' + buildId + '.md');
    var reportData = '';
    if (testCloudResults != null && testCloudResults.length > 0) {
        for (var i = 0; i < testCloudResults.length; i++) {
            reportData = reportData.concat(testCloudResults[i] + '<br>');
        }
    }

    tl.debug('reportdata = ' + reportData);
    tl.writeFile(mdReportFile, reportData);
    tl.command('task.addattachment', {
            name: "Xamarin Test Cloud Results",
            type: "Distributedtask.Core.Summary"
        }, mdReportFile);
}

function publishTestResults() {
    if (publishNUnitResults == 'true') {

        var allFiles = tl.find(testDir);
        var matchingTestResultsFiles = minimatch.match(allFiles, 'xamarintest_' + buildId + '*.xml', {matchBase: true}) || [];

        var tp = new tl.TestPublisher("NUnit");
        tp.publish(matchingTestResultsFiles.toString(), "", "", "", "", "");
    }
}

var submitToTestCloud = function (index) {
    // Find location of mono
    if (isWin) {
        var testCloudRunner = tl.tool(testCloud);
    } else {
        var monoPath = tl.which('mono', true);
        var testCloudRunner = tl.tool(monoPath);
        testCloudRunner.arg(testCloud);
    }
    // Form basic arguments
    testCloudRunner.arg('submit');
    testCloudRunner.arg(appFiles[index]);
    testCloudRunner.arg(teamApiKey);
    testCloudRunner.arg('--user');
    testCloudRunner.arg(user);
    testCloudRunner.arg('--devices');
    testCloudRunner.arg(devices);
    testCloudRunner.arg('--series');
    testCloudRunner.arg(series);
    testCloudRunner.arg('--locale');
    if (locale == 'user') {
        testCloudRunner.arg(userDefinedLocale);
    }
    else {
        testCloudRunner.arg(locale);
    }
    testCloudRunner.arg('--assembly-dir');
    testCloudRunner.arg(testDir);
    if (parallelization != 'none') {
        testCloudRunner.arg(parallelization);
    }
    if (optionalArgs) {
        testCloudRunner.line(optionalArgs);
    }
    if (publishNUnitResults == 'true') {
        var nunitFile = path.join(testDir, '/xamarintest_' + buildId + '.' + index + '.xml');
        testCloudRunner.arg('--nunit-xml');
        testCloudRunner.arg(nunitFile);
    }

    // For an iOS .ipa app, look for an accompanying dSYM file
    if (dsym && path.extname(appFiles[index]) == '.ipa') {
        // Find dSYM files matching the specified pattern
        // Check in one folder up since IPAs are now generated under a timestamped folder
        var ipaFolder = path.dirname(path.dirname(appFiles[index]));
        tl.debug('Checking for dSYM files under: ' + ipaFolder);
        var alldsymFiles = tl.find(ipaFolder);
        var dsymFiles = minimatch.match(alldsymFiles, dsym, {matchBase: true});

        if (!dsymFiles || dsymFiles.length == 0) {
            tl.warning('No matching dSYM files were found with pattern: ' + dsym);
        }
        else if (dsymFiles.length > 1) {
            tl.warning('More than one matching dSYM file was found with pattern: ' + dsym);
        }
        else {
            // Include dSYM file in Test Cloud arguments
            testCloudRunner.arg('--dsym');
            testCloudRunner.arg(dsymFiles[0]);
        }
    }

    //read stdout
    testCloudRunner.on('stdout', function (data) {
        if (data) {
            var matches = data.toString().toLowerCase().match(/https:\/\/testcloud.xamarin.com\/test\/.+\//g);
            if (matches != null) {
                testCloudResults = testCloudResults.concat(matches);
            }
        }
    });


    // Submit to Test Cloud
    tl.debug('Submitting to Xamarin Test Cloud: ' + appFiles[index]);
    testCloudRunner.exec()
        .then(onRunComplete)
        .fail(onFailedExecution)
}

submitToTestCloud(appFileIndex);

let shouldFail = tl.getVariable('FAIL_DEPRECATED_BUILD_TASK');

if (shouldFail != null && shouldFail.toLowerCase() === 'true') {
	throw new Error(tl.loc("DeprecatedTask"));
}