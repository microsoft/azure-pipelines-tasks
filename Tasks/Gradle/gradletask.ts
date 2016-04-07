/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import tl = require('vsts-task-lib/task');
import fs = require('fs');
import path = require('path');

var uuid = require('node-uuid');

var wrapperScript = tl.getPathInput('wrapperScript', true, true);
fs.chmodSync(wrapperScript, "755"); //Make sure the wrapper script is executable

//working directory
var cwd = tl.getInput('cwd');
if (!cwd) {
    cwd = path.dirname(wrapperScript);
}
tl.cd(cwd);

var gb = tl.createToolRunner(wrapperScript);
var gbOptions = tl.getDelimitedInput('options', ' ', false);
var gbTasks = ['clean'];
gbTasks = gbTasks.concat(tl.getDelimitedInput('tasks', ' ', true));
var javaHomeSelection = tl.getInput('javaHomeSelection', true);
var jdkVersion = tl.getInput('jdkVersion');
var jdkArchitecture = tl.getInput('jdkArchitecture');
var buildFolder = tl.getVariable('agent.buildDirectory');
var publishJUnitResults = tl.getInput('publishJUnitResults');
var buildTool = "gradle";
var ccTool = tl.getInput('codeCoverageTool');
var classFileDirs = tl.getInput('classFilesDirectories');
var classFilter = tl.getInput('classFilter');
var summaryFile = null;
var reportDir = null;
var ccReportingTask = "";
var codeCoverageOpted = (typeof ccTool != "undefined" && ccTool && ccTool.toLowerCase() != 'none');
var publishJUnitResultsOpted = (typeof publishJUnitResults != "undefined" && publishJUnitResults && publishJUnitResults.toLowerCase() == 'true');

// update JAVA_HOME if user selected specific JDK version or set path manually
var specifiedJavaHome = extractJavaHome();
if (specifiedJavaHome) {
    tl.debug('Set JAVA_HOME to ' + specifiedJavaHome);
    process.env['JAVA_HOME'] = specifiedJavaHome;
}

if (codeCoverageOpted) {
    enableCodeCoverage();
}

gb.arg(gbOptions);
gb.arg(gbTasks);
gb.arg(ccReportingTask)
gb.exec()
    .then(function(code) {
        publishTestResults(publishJUnitResultsOpted);
        publishCodeCoverage(codeCoverageOpted);
        tl.exit(code);
    })
    .fail(function(err) {
        tl.error(err.message);
        tl.debug('taskRunner fail');
        tl.exit(1);
    })

function publishTestResults(publishJUnitResultsOpted: boolean) {
    if (publishJUnitResultsOpted) {
        var testResultsFiles = tl.getInput('testResultsFiles', true);
        //check for pattern in testResultsFiles
        if (testResultsFiles.indexOf('*') >= 0 || testResultsFiles.indexOf('?') >= 0) {
            tl.debug('Pattern found in testResultsFiles parameter');

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

function extractJavaHome() {
    if (javaHomeSelection == 'JDKVersion') {
        tl.debug('Using JDK version to find and set JAVA_HOME');

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

    return specifiedJavaHome;
}

function enableCodeCoverage() {
    var reportDir = path.join(cwd + "/" + uuid.v1());
    fs.mkdirSync(reportDir);

    var isMultiModule = isMultiModuleProject(wrapperScript);

    if (ccTool.toLowerCase() == "jacoco") {
        if (isMultiModule) {
            ccReportingTask = "jacocoRootReport";
        } else {
            ccReportingTask = "jacocoTestReport";
        }
        summaryFile = path.join(reportDir + "/summary.xml");
    } else {
        summaryFile = path.join(reportDir + "/coverage.xml")
        ccReportingTask = "cobertura"
    }

    var buildProps: { [key: string]: string } = {};
    buildProps['classfiledirs'] = classFileDirs;
    buildProps['classfilter'] = classFilter;
    buildProps['summaryfile'] = summaryFile;
    buildProps['reportdir'] = reportDir;
    buildProps['buildfile'] = path.join(cwd + "/build.gradle");
    buildProps['ismultimodule'] = String(isMultiModule);

    var ccEnabler = new tl.CodeCoverageEnabler("gradle", ccTool);
    ccEnabler.enableCodeCoverage(buildProps);
}

function publishCodeCoverage(codeCoverageOpted: boolean) {
    if (codeCoverageOpted) {
        var ccPublisher = new tl.CodeCoveragePublisher();
        ccPublisher.publish(ccTool, summaryFile, reportDir, "");
    }
}

function isMultiModuleProject(wrapperScript: string): boolean {
    var gradleBuild = tl.createToolRunner(wrapperScript);
    gradleBuild.arg("properties");

    var data = gradleBuild.execSync().stdout;
    var regex = new RegExp("subprojects: .*");
    var subProjects = regex.exec(data);
    tl.debug("Data: " + subProjects);

    if (subProjects && subProjects.length > 0) {
        tl.debug("Sub Projects info: " + subProjects.toString());
        return (subProjects.join(',').toLowerCase() != "subprojects: []");
    }

    return false;
}
