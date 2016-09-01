/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require('fs');
import os = require('os');
import {CodeCoverageEnablerFactory} from 'codecoverage-tools/codecoveragefactory';

var isWindows = os.type().match(/^Win/);

function pathExistsAsFile(path: string) {
    try {
        return tl.stats(path).isFile();
    }
    catch (error) {
        return false;
    }
}

function publishTestResults(publishJUnitResults, testResultsFiles: string) {
    if (publishJUnitResults == 'true') {
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

function processAntOutputLine(line) {
    if (line == null) {
        return;
    }

    let javacText = "[javac] ";
    //[java] [javac] c:\path\to\file:100: error: error_msg
    let compileErrorFileRegexWin = /^(\[java\])?\s*\[javac\]\s*([^:]:[^:]+):(\d+):\s*(.+)$/
    //[java] [javac] /path/to/file:100: error: error_msg
    let compileErrorFileRegexUnix = /^(\[java\])?\s*\[javac\]\s*([^:]+):(\d+):\s*(.+)$/
    let compileErrorFileRegex = (isWindows) ? compileErrorFileRegexWin : compileErrorFileRegexUnix;

    let severity = null;
    if (line.indexOf(javacText) >= 0) {
        // parse javac errors and warnings
        let matches = compileErrorFileRegex.exec(line);
        if (matches) {
            let errorMessage = matches[4];
            if (errorMessage) {
                if (errorMessage.startsWith('warning:')) {
                    severity = 'warning';
                } else if (errorMessage.startsWith('error:')) {
                    severity = 'error';
                }
            }

            tl.command('task.issue', {
                type: severity,
                sourcepath: matches[2],
                linenumber: matches[3],
            }, matches[0]);
        }
    }
}


async function doWork() {

    function enableCodeCoverage(): Q.Promise<any> {
        if (!isCodeCoverageOpted) {
            return Q.resolve(true);
        }

        var classFilter: string = tl.getInput('classFilter');
        var classFilesDirectories: string = tl.getInput('classFilesDirectories', true);
        var sourceDirectories: string = tl.getInput('srcDirectories');
        // appending with small guid to keep it unique. Avoiding full guid to ensure no long path issues.
        var reportDirectoryName = "CCReport43F6D5EF";
        reportDirectory = path.join(buildRootPath, reportDirectoryName);
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
        buildProps['ccreporttask'] = "CodeCoverage_9064e1d0"
        buildProps['reportbuildfile'] = reportBuildFile;
        
         let ccEnabler = new CodeCoverageEnablerFactory().getTool("ant", ccTool.toLowerCase());
        return ccEnabler.enableCodeCoverage(buildProps);
    }

    function publishCodeCoverage(codeCoverageOpted: boolean) {
        if (codeCoverageOpted && ccReportTask) {
            tl.debug("Collecting code coverage reports");
            var antRunner = tl.tool(anttool);
            antRunner.arg('-buildfile');
            if (pathExistsAsFile(reportBuildFile)) {
                antRunner.arg(reportBuildFile);
                antRunner.arg(ccReportTask);
            }
            else {
                antRunner.arg(antBuildFile);
                antRunner.arg(ccReportTask);
            }
            antRunner.exec().then(function (code) {
                if (pathExistsAsFile(summaryFile)) {
                    tl.debug("Summary file = " + summaryFile);
                    tl.debug("Report directory = " + reportDirectory);
                    tl.debug("Publishing code coverage results to TFS");
                    var ccPublisher = new tl.CodeCoveragePublisher();
                    ccPublisher.publish(ccTool, summaryFile, reportDirectory, "");
                }
                else {
                    tl.warning("No code coverage results found to be published. This could occur if there were no tests executed or there was a build failure. Check the ant output for details.");
                }
            }).fail(function (err) {
                tl.warning("No code coverage results found to be published. This could occur if there were no tests executed or there was a build failure. Check the ant output for details.");
            });
        }
    }

    try {
        var anttool = tl.which('ant', true);
        var antv = tl.tool(anttool);
        antv.arg('-version');

        var antb = tl.tool(anttool);
        var antBuildFile = tl.getPathInput('antBuildFile', true, true);
        antb.arg('-buildfile');
        antb.arg(antBuildFile);

        // options and targets are optional
        antb.arg(tl.getInput('options', false));
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
            tl.warning('The ANT_HOME environment variable is not set.  Please make sure that it exists and is set to the location of the bin folder.  See https://ant.apache.org/manual/install.html.');
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
                    throw new Error('Failed to find specified JDK version. Please make sure environment variable ' + envName + ' exists and is set to the location of a corresponding JDK.');
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
        var summaryFile: string = null;
        var reportDirectory: string = null;
        var ccReportTask: string = null;
        var reportBuildFile: string = null;
        var publishJUnitResults = tl.getInput('publishJUnitResults');
        var testResultsFiles = tl.getInput('testResultsFiles', true);

        //delete any previous cobertura instrumented classes as they might interfere with ant execution.
        tl.rmRF(instrumentedClassesDirectory, true);

        enableCodeCoverage().then(function (resp) {
            ccReportTask = "CodeCoverage_9064e1d0";
        }).catch(function (err) {
            tl.warning("Failed to enable code coverage: " + err);
        }).fin(function () {
            
            //antv.exec();
            var buffer;
            antb.on('stdout', (data) => {
                if (data) {
                    buffer += data.toString();
                    let idx = buffer.indexOf(os.EOL);
                    while (idx > -1) {
                        let line = buffer.substring(0, idx);
                        processAntOutputLine(line);
                        buffer = buffer.substring(idx + os.EOL.length);
                        idx = buffer.indexOf(os.EOL);
                    }
                }
            });

            antb.exec()
                .then(function (code) {
                    publishTestResults(publishJUnitResults, testResultsFiles);
                    publishCodeCoverage(isCodeCoverageOpted);
                    tl.setResult(tl.TaskResult.Succeeded, "Task succeeded");
                })
                .fail(function (err) {
                    publishTestResults(publishJUnitResults, testResultsFiles);
                    console.error(err.message);
                    tl.debug('taskRunner fail');
                    tl.setResult(tl.TaskResult.Failed, err);
                });
        });
    } catch (e) {
        tl.debug(e.message);
        tl._writeError(e);
        tl.setResult(tl.TaskResult.Failed, e.message);
    }
}

doWork();

