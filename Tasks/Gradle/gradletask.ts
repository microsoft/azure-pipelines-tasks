/// <reference path="../../definitions/vsts-task-lib.d.ts" />
/// <reference path="../../definitions/codecoveragefactory.d.ts" />

import tl = require('vsts-task-lib/task');
import fs = require('fs');
import path = require('path');
import * as Q from "q";
import os = require('os');

import sqCommon = require('./CodeAnalysis/SonarQube/common');
import sqGradle = require('./CodeAnalysis/gradlesonar');
import {CodeAnalysisOrchestrator} from './CodeAnalysis/Common/CodeAnalysisOrchestrator';
import {BuildOutput, BuildEngine} from './CodeAnalysis/Common/BuildOutput';
import {PmdTool} from './CodeAnalysis/Common/PmdTool';
import {CheckstyleTool} from './CodeAnalysis/Common/CheckstyleTool';
import {CodeCoverageEnablerFactory} from 'codecoverage-tools/codecoveragefactory';
import sshCommon = require('ssh-common/ssh-common');

var isWindows = os.type().match(/^Win/);

// Set up localization resource file
tl.setResourcePath(path.join(__dirname, 'task.json'));

var wrapperScript = tl.getPathInput('wrapperScript', true, true);

if (isWindows) {
    // append .bat extension name on Windows platform
    if (!wrapperScript.endsWith('bat')) {
        tl.debug("Append .bat extension name to gradlew script.");
        wrapperScript += '.bat';
    }
} 

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

var gb = tl.tool(wrapperScript);
var javaHomeSelection = tl.getInput('javaHomeSelection', true);
var specifiedJavaHome = null;
var ccTool = tl.getInput('codeCoverageTool');
var isCodeCoverageOpted = (typeof ccTool != "undefined" && ccTool && ccTool.toLowerCase() != 'none');
var publishJUnitResults = tl.getBoolInput('publishJUnitResults');
var testResultsFiles = tl.getInput('testResultsFiles', true);
var summaryFile: string = null;
var reportDirectory: string = null;
var inputTasks: string[] = tl.getDelimitedInput('tasks', ' ', true);
var isSonarQubeEnabled: boolean = sqCommon.isSonarQubeAnalysisEnabled();
let reportingTaskName = "";

let buildOutput: BuildOutput = new BuildOutput(tl.getVariable('build.sourcesDirectory'), BuildEngine.Gradle);
var codeAnalysisOrchestrator = new CodeAnalysisOrchestrator(
    [new CheckstyleTool(buildOutput, 'checkstyleAnalysisEnabled'),
        new PmdTool(buildOutput, 'pmdAnalysisEnabled')])

if (isCodeCoverageOpted && inputTasks.indexOf('clean') == -1) {
    gb.arg('clean'); //if user opts for code coverage, we append clean functionality to make sure any uninstrumented class files are removed
}

gb.arg(tl.getInput('options', false));
gb.arg(inputTasks);

// update JAVA_HOME if user selected specific JDK version or set path manually
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
 
/* Trigger code coverage enable flow and then build */
enableCodeCoverage()
    .then(function (resp) {
        gb.arg(reportingTaskName);
    }).catch(function (err) {
        tl.warning("Failed to enable code coverage: " + err);
    }).fin(function () {
        setGradleOpts();
        enableSonarQubeAnalysis();
        execBuild();
    });

/* Actual execution of Build and further flows*/
function execBuild() {
    var gradleResult;
    gb.exec()
        .then(function (code) {
            gradleResult = code;
            publishTestResults(publishJUnitResults, testResultsFiles);
            publishCodeCoverage(isCodeCoverageOpted);
            return processCodeAnalysisResults();
        })
        .then(() => {
            tl.exit(gradleResult);
        })
        .fail(function (err) {
            publishTestResults(publishJUnitResults, testResultsFiles);
            console.error(err);
            tl.debug('taskRunner fail');
            tl.exit(1);
        });
}

function enableSonarQubeAnalysis() {
    if (isSonarQubeEnabled) {
        // Looks like: 'SonarQube analysis is enabled.'
        console.log(tl.loc('codeAnalysis_ToolIsEnabled'), sqCommon.toolName);

        gb = sqGradle.applyEnabledSonarQubeArguments(gb);
        gb = sqGradle.applySonarQubeCodeCoverageArguments(gb, isCodeCoverageOpted, ccTool, summaryFile);
    }
    gb = codeAnalysisOrchestrator.configureBuild(gb);
}

function processCodeAnalysisResults(): Q.Promise<void> {

    tl.debug('Processing code analysis results');
    codeAnalysisOrchestrator.publishCodeAnalysisResults();

    return sqGradle.processSonarQubeIntegration();
}

// Configure the JVM associated with this run.
function setGradleOpts() {
    let gradleOptsValue: string = tl.getInput('gradleOpts');

    if (gradleOptsValue) {
        process.env['GRADLE_OPTS'] = gradleOptsValue;
        tl.debug(`GRADLE_OPTS is now set to ${gradleOptsValue}`);
    }
}

/* Functions for Publish Test Results, Code Coverage */
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

        if (!matchingTestResultsFiles || matchingTestResultsFiles.length == 0) {
            tl.warning('No test result files matching ' + testResultsFiles + ' were found, so publishing JUnit test results is being skipped.');
            return 0;
        }

        var tp = new tl.TestPublisher("JUnit");
        tp.publish(matchingTestResultsFiles, true, "", "", "", true);
    }
}

function enableCodeCoverage(): Q.Promise<any> {
    if (!isCodeCoverageOpted) {
        return Q.resolve(true);
    }

    tl.debug("Option to enable code coverage was selected and is being applied.");
    var classFilter: string = tl.getInput('classFilter');
    var classFilesDirectories: string = tl.getInput('classFilesDirectories');
    var buildRootPath = cwd;
    var reportDirectoryName = "CCReport43F6D5EF";
    reportDirectory = path.join(buildRootPath, reportDirectoryName);
    var isMultiModule = isMultiModuleProject(wrapperScript);

    if (ccTool.toLowerCase() == "jacoco") {
        var summaryFileName = "summary.xml";

        if (isMultiModule) {
            reportingTaskName = "jacocoRootReport";
        }
        else {
            reportingTaskName = "jacocoTestReport";
        }
    }
    else if (ccTool.toLowerCase() == "cobertura") {
        var summaryFileName = "coverage.xml";
        reportingTaskName = "cobertura";
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

    let ccEnabler = new CodeCoverageEnablerFactory().getTool("gradle", ccTool.toLowerCase());
    return ccEnabler.enableCodeCoverage(buildProps);
}

function isMultiModuleProject(wrapperScript: string): boolean {
    var gradleBuild = tl.tool(wrapperScript);
    gradleBuild.arg("properties");
    gradleBuild.arg(tl.getInput('options', false));

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
        if (tl.exist(summaryFile)) {
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