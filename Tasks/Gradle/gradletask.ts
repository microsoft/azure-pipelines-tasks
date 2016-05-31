/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import tl = require('vsts-task-lib/task');
import fs = require('fs');
import path = require('path');

// Lowercased file names are to lessen the likelihood of xplat issues
import sqGradle = require('./gradlesonar');

var wrapperScript = tl.getPathInput('wrapperScript', true, true);
if (fs.existsSync(wrapperScript)) {
    // (The exists check above is not necessary, but we need to avoid this call when we are running L0 tests.)
    // Make sure the wrapper script is executable
    fs.chmodSync(wrapperScript, "755");
}

//working directory
var cwd = tl.getPathInput('cwd', false, true);
if (!cwd) {
    cwd = path.dirname(wrapperScript);
}
tl.cd(cwd);

var gb = tl.createToolRunner(wrapperScript);

gb.argString(tl.getInput('options', false));
gb.arg(tl.getDelimitedInput('tasks', ' ', true));
gb = sqGradle.applyEnabledSonarQubeArguments(gb);

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

if (isCodeCoverageOpted) {
    var summaryFile: string = null;
    var reportDirectory: string = null;
    enableCodeCoverage()
}
else {
    tl.debug("Option to enable code coverage was not selected and is being skipped.");
}

var publishJUnitResults = tl.getBoolInput('publishJUnitResults');
var testResultsFiles = tl.getInput('testResultsFiles', true);

gb.exec()
    .then(function(code) {
        publishTestResults(publishJUnitResults, testResultsFiles);
        publishCodeCoverage(isCodeCoverageOpted)
        tl.exit(code);
    })
    .fail(function(err) {
        publishTestResults(publishJUnitResults, testResultsFiles);
        console.error(err.message);
        tl.debug('taskRunner fail');
        tl.exit(1);
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

function enableCodeCoverage() {
    var classFilter: string = tl.getInput('classFilter');
    var classFilesDirectories: string = tl.getInput('classFilesDirectories');
    var buildRootPath = cwd;
    var reportDirectoryName = "CCReport43F6D5EF";
    reportDirectory = path.join(buildRootPath, reportDirectoryName);
    var isMultiModule = isMultiModuleProject(wrapperScript);

    if (ccTool.toLowerCase() == "jacoco") {
        var summaryFileName = "summary.xml";

        if (isMultiModule) {
            var reportingTaskName = "jacocoRootReport";
        }
        else {
            var reportingTaskName = "jacocoTestReport";
        }
    }
    else if (ccTool.toLowerCase() == "cobertura") {
        var summaryFileName = "coverage.xml";
        var reportingTaskName = "cobertura";
    }

    summaryFile = path.join(reportDirectory, summaryFileName);
    var buildFile = path.join(buildRootPath, "build.gradle");

    tl.rmRF(reportDirectory, true);

    var buildProps: { [key: string]: string } = {};
    buildProps['buildfile'] = buildFile;
    buildProps['classfilter'] = classFilter
    buildProps['classfilesdirectories'] = classFilesDirectories;
    buildProps['summaryfile'] = summaryFileName;
    buildProps['reportdirectory'] = reportDirectoryName;
    buildProps['ismultimodule'] = String(isMultiModule);

    try {
        var codeCoverageEnabler = new tl.CodeCoverageEnabler('Gradle', ccTool);
        codeCoverageEnabler.enableCodeCoverage(buildProps);
        tl.debug("Code coverage is successfully enabled.");
    }
    catch (Error) {
        tl.warning("Enabling code coverage failed. Check the build logs for errors.");
    }
    gb.arg(reportingTaskName);
}

function isMultiModuleProject(wrapperScript: string): boolean {
    var gradleBuild = tl.createToolRunner(wrapperScript);
    gradleBuild.arg("properties");

    var data = gradleBuild.execSync().stdout;
    if (typeof data != "undefined" && data) {
        var regex = new RegExp("subprojects: .*");
        var subProjects = regex.exec(data);
        tl.debug("Data: " + subProjects);

        if (typeof subProjects != "undefined" && subProjects && subProjects.length > 0) {
            tl.debug("Sub Projects info: " + subProjects.toString());
            return (subProjects.join(',').toLowerCase() != "subprojects: []");
        }
    }

    return false;
}

function publishCodeCoverage(isCodeCoverageOpted: boolean) {
    if (isCodeCoverageOpted) {
        if (pathExistsAsFile(summaryFile)) {
            tl.debug("Summary file = " + summaryFile);
            tl.debug("Report directory = " + reportDirectory);
            tl.debug("Publishing code coverage results to TFS");
            var ccPublisher = new tl.CodeCoveragePublisher();
            ccPublisher.publish(ccTool, summaryFile, reportDirectory, "");
        }
        else {
            tl.warning("No code coverage results found to be published. This could occur if there were no tests executed or there was a build failure. Check the gradle output for details.");
        }
    }
}

function pathExistsAsFile(path: string) {
    try {
        return tl.stats(path).isFile();
    }
    catch (error) {
        return false;
    }
}
