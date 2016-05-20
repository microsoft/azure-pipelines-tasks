/// <reference path="../../definitions/vsts-task-lib.d.ts" />
/// <reference path="../../definitions/shelljs.d.ts" />

import fs = require('fs');
import path = require('path');
import os = require('os');
import tl = require('vsts-task-lib/task');

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
    tl.exit(1);
}

// Resolve apps for the specified value or pattern
if (app.indexOf('*') == -1 && app.indexOf('?') == -1) {
    // Check literal path to a single app file
    if (!tl.exist(app)) {
        onError('The specified app file does not exist: ' + app);
    }

    // Use the single specified app file
    var appFiles = [app];
}
else {
    // Find app files matching the specified pattern    
    tl.debug('Pattern found in app parameter');
    var buildFolder = tl.getVariable('agent.buildDirectory');
    var allappFiles = tl.find(buildFolder);
    var appFiles = tl.match(allappFiles, app, {matchBase: true});

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
if (testCloudLocation.indexOf('*') == -1 && testCloudLocation.indexOf('?') == -1) {
    // Check literal path to test-cloud.exe
    if (!tl.exist(testCloudLocation)) {
        onError('test-cloud.exe does not exist at the specified location: ' + testCloudLocation);
    }

    // Use literal path to test-cloud.exe
    var testCloud = testCloudLocation;
}
else {
    // Find test-cloud.exe under the specified directory pattern
    tl.debug('Pattern found in testCloudLocation parameter');
    var buildFolder = tl.getVariable('agent.buildDirectory');
    var allexeFiles = tl.find(buildFolder);
    var testCloudExecutables = tl.match(allexeFiles, testCloudLocation, {matchBase: true});

    // Fail if not found
    if (!testCloudExecutables || testCloudExecutables.length == 0) {
        onError('test-cloud.exe could not be found with search pattern ' + testCloudLocation);
    }

    // Use first found path to test-cloud.exe
    var testCloud = testCloudExecutables[0];
}


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
            // Error executing
            tl.exit(1);
        }
        else {
            tl.exit(0); // Done submitting all app files
        }
    } else {
        // Submit next app file
        submitToTestCloud(appFileIndex);
    }
}
var onFailedExecution = function (err) {
    runFailures = 'true';
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
    fs.writeFile(mdReportFile, reportData, function (err) {
        if (err) {
            tl.warning('Failed to create Xamarin Test Cloud run summary report. ' + err);
        } else {
            tl.command('task.addattachment', {
                name: "Xamarin Test Cloud Results",
                type: "Distributedtask.Core.Summary"
            }, mdReportFile);
        }
    })

}

function publishTestResults() {
    if (publishNUnitResults == 'true') {

        var allFiles = tl.find(testDir);
        var matchingTestResultsFiles = tl.match(allFiles, 'xamarintest_' + buildId + '*.xml', {matchBase: true});

        var tp = new tl.TestPublisher("NUnit");
        tp.publish(matchingTestResultsFiles, false, "", "", "", "");
    }
}

var submitToTestCloud = function (index) {
    // Find location of mono
    if (isWin) {
        var testCloudRunner = tl.createToolRunner(testCloud);
    } else {
        var monoPath = tl.which('mono', true);
        var testCloudRunner = tl.createToolRunner(monoPath);
        testCloudRunner.arg(testCloud);
    }
    // Form basic arguments
    testCloudRunner.arg('submit');
    testCloudRunner.pathArg(appFiles[index]);
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
    testCloudRunner.pathArg(testDir);
    if (parallelization != 'none') {
        testCloudRunner.arg(parallelization);
    }
    if (optionalArgs) {
        testCloudRunner.argString(optionalArgs);
    }
    if (publishNUnitResults == 'true') {
        var nunitFile = path.join(testDir, '/xamarintest_' + buildId + '.' + index + '.xml');
        testCloudRunner.arg('--nunit-xml');
        testCloudRunner.pathArg(nunitFile);
    }

    // For an iOS .ipa app, look for an accompanying dSYM file
    if (dsym && path.extname(appFiles[index]) == '.ipa') {
        // Find dSYM files matching the specified pattern
        var alldsymFiles = tl.find(path.dirname(appFiles[index]));
        var dsymFiles = tl.match(alldsymFiles, dsym, {matchBase: true});

        if (!dsymFiles || dsymFiles.length == 0) {
            tl.warning('No matching dSYM files were found with pattern: ' + dsym);
        }
        else if (dsymFiles.length > 1) {
            tl.warning('More than one matching dSYM file was found with pattern: ' + dsym);
        }
        else {
            // Include dSYM file in Test Cloud arguments
            testCloudRunner.arg('--dsym');
            testCloudRunner.pathArg(dsymFiles[0]);
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
