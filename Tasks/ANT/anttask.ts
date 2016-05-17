/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require('fs');

var anttool = tl.which('ant', true);
var antv = tl.createToolRunner(anttool);
antv.arg('-version');

var antb = tl.createToolRunner(anttool);
var antBuildFile = tl.getPathInput('antBuildFile', true, true);
antb.arg('-buildfile');
antb.pathArg(antBuildFile);

// options and targets are optional
antb.argString(tl.getInput('options', false));
antb.arg(tl.getDelimitedInput('targets', ' ', false));

// update ANT_HOME if user specified path manually (not required, but if so, check it)
var antHomeUserInputPath = tl.getPathInput('antHomeUserInputPath', false, true);
if (antHomeUserInputPath) {
    tl.debug('Using path from user input to set ANT_HOME');
    tl.debug('Set ANT_HOME to ' + antHomeUserInputPath);
    process.env['ANT_HOME'] = antHomeUserInputPath;
}

// Warn if ANT_HOME is not set either locally or on the task via antHomeUserInputPath
var antHome = tl.getVariable('ANT_HOME');
if (!antHome) {
    tl.warning('The ANT_HOME environment variable is not set.  Please make sure that it exists and is set to the location of the bin folder.  See http://ant.apache.org/manual/install.html.');
}

// update JAVA_HOME if user selected specific JDK version or set path manually
var javaHomeSelection = tl.getInput('javaHomeSelection', true);
var specifiedJavaHome = null;

if (javaHomeSelection == 'JDKVersion') {
    tl.debug('Using JDK version to find and set JAVA_HOME');
    var jdkVersion = tl.getInput('jdkVersion');
    var jdkArchitecture = tl.getInput('jdkArchitecture');

    if (jdkVersion != 'default') {
        // jdkVersion should be in the form of 1.7, 1.8, or 1.10
        // jdkArchitecture is either x64 or x86
        // envName for version 1.7 and x64 would be "JAVA_HOME_7_X64"
        var envName = "JAVA_HOME_" + jdkVersion.slice(2) + "_" + jdkArchitecture.toUpperCase();
        specifiedJavaHome = tl.getVariable(envName);
        if (!specifiedJavaHome) {
            tl.error('Failed to find specified JDK version. Please make sure environment variable ' + envName + ' exists and is set to the location of a corresponding JDK.');
            tl.exit(1);
        }
    }
}
else {
    tl.debug('Using path from user input to set JAVA_HOME');
    var jdkUserInputPath = tl.getPathInput('jdkUserInputPath', true, true);
    specifiedJavaHome = jdkUserInputPath;
}

if (specifiedJavaHome) {
    tl.debug('Set JAVA_HOME to ' + specifiedJavaHome);
    process.env['JAVA_HOME'] = specifiedJavaHome;
}

var ccTool = tl.getInput('codeCoverageTool');
var isCodeCoverageOpted = (typeof ccTool != "undefined" && ccTool && ccTool.toLowerCase() != 'none');

var buildRootPath = path.dirname(antBuildFile);
var instrumentedClassesDirectory = path.join(buildRootPath, "InstrumentedClasses");
//delete any previous cobertura instrumented classes as they might interfere with ant execution.
tl.rmRF(instrumentedClassesDirectory, true);

if (isCodeCoverageOpted) {
    var summaryFile = null;
    var reportDirectory = null;
    var ccReportTask = null;
    var reportBuildFile = null;
    enableCodeCoverage();
}
else {
    tl.debug("Option to enable code coverage was not selected and is being skipped.");
}

var publishJUnitResults = tl.getInput('publishJUnitResults');
var testResultsFiles = tl.getInput('testResultsFiles', true);

antv.exec()
    .then(function(code) {
        return antb.exec();
    })
    .then(function(code) {
        publishTestResults(publishJUnitResults, testResultsFiles);
        publishCodeCoverage(isCodeCoverageOpted);
        tl.exit(code);
    })
    .fail(function(err) {
        publishTestResults(publishJUnitResults, testResultsFiles);
        console.error(err.message);
        tl.debug('taskRunner fail');
        tl.exit(1);
    })

function publishTestResults(publishJUnitResults, testResultsFiles: string) {
    if (publishJUnitResults == 'true') {
        //check for pattern in testResultsFiles
        if (testResultsFiles.indexOf('*') >= 0 || testResultsFiles.indexOf('?') >= 0) {
            tl.debug('Pattern found in testResultsFiles parameter');
            var buildFolder = tl.getVariable('agent.buildDirectory');
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

function enableCodeCoverage() {
    var classFilter = tl.getInput('classFilter');
    var classFilesDirectories = tl.getInput('classFilesDirectories', true);
    var sourceDirectories = tl.getInput('srcDirectories');
    // appending with small guid to keep it unique. Avoiding full guid to ensure no long path issues.
    var reportDirectoryName = "CCReport43F6D5EF";
    reportDirectory = path.join(buildRootPath, reportDirectoryName);
    ccReportTask = "CodeCoverage_9064e1d0";
    var reportBuildFileName = "CCReportBuildA4D283EG.xml";
    reportBuildFile = path.join(buildRootPath, reportBuildFileName);
    var summaryFileName = "coverage.xml";
    summaryFile = path.join(buildRootPath, reportDirectoryName);
    summaryFile = path.join(summaryFile, summaryFileName);
    var coberturaCCFile = path.join(buildRootPath, "cobertura.ser");
    
    // clean any previous reports.
    tl.rmRF(coberturaCCFile, true);
    tl.rmRF(reportDirectory, true);
    tl.rmRF(reportBuildFile, true);

    var buildProps: { [key: string]: string } = {};
    buildProps['buildfile'] = antBuildFile;
    buildProps['classfilter'] = classFilter
    buildProps['classfilesdirectories'] = classFilesDirectories;
    buildProps['sourcedirectories'] = sourceDirectories;
    buildProps['summaryfile'] = summaryFileName;
    buildProps['reportdirectory'] = reportDirectory;
    buildProps['ccreporttask'] = ccReportTask
    buildProps['reportbuildfile'] = reportBuildFile;
    try {
        var codeCoverageEnabler = new tl.CodeCoverageEnabler('Ant', ccTool);
        codeCoverageEnabler.enableCodeCoverage(buildProps);
        tl.debug("Code coverage is successfully enabled.");
    }
    catch (Error) {
        tl.warning("Enabling code coverage failed. Check the build logs for errors.");
    }
}

function publishCodeCoverage(codeCoverageOpted: boolean) {
    if (codeCoverageOpted) {
        tl.debug("Collecting code coverage reports");
        var antRunner = tl.createToolRunner(anttool);
        antRunner.arg('-buildfile');
        if (isFileExists(reportBuildFile)) {
            antRunner.pathArg(reportBuildFile);
            antRunner.arg(ccReportTask);
        }
        else {
            antRunner.pathArg(antBuildFile);
            antRunner.arg(ccReportTask);
        }
        antRunner.exec().then(function(code) {
            if (isFileExists(summaryFile)) {
                tl.debug("Summary file = " + summaryFile);
                tl.debug("Report directory = " + reportDirectory);
                tl.debug("Publishing code coverage results to TFS");
                var ccPublisher = new tl.CodeCoveragePublisher();
                ccPublisher.publish(ccTool, summaryFile, reportDirectory, "");
            }
            else {
                tl.warning("No code coverage results found to be published. This could occur if there were no tests executed or there was a build failure. Check the ant output for details.");
            }
        }).fail(function(err) {
            tl.warning("No code coverage results found to be published. This could occur if there were no tests executed or there was a build failure. Check the ant output for details.");
        });
    }
}

function isFileExists(path: string) {
    try {
        return tl.stats(path).isFile();
    }
    catch (error) {
        return false;
    }
}

function isDirectoryExists(path: string) {
    try {
        return tl.stats(path).isDirectory();
    }
    catch (error) {
        return false;
    }
}