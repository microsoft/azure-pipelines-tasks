import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as Q from "q";
import * as tl from 'vsts-task-lib/task';

import * as javacommons from 'java-common/java-common';
import * as ccUtils from 'codecoverage-tools/codecoverageutilities';
import {CodeCoverageEnablerFactory} from 'codecoverage-tools/codecoveragefactory';

tl.setResourcePath(path.join(__dirname, 'task.json'));

const TESTRUN_SYSTEM = "VSTS - ant";
const isWindows = os.type().match(/^Win/);

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
        let matchingTestResultsFiles;
        if (testResultsFiles.indexOf('*') >= 0 || testResultsFiles.indexOf('?') >= 0) {
            tl.debug('Pattern found in testResultsFiles parameter');
            const buildFolder = tl.getVariable('System.DefaultWorkingDirectory');
            matchingTestResultsFiles = tl.findMatch(buildFolder, testResultsFiles, null, { matchBase: true });
        }
        else {
            tl.debug('No pattern found in testResultsFiles parameter');
            matchingTestResultsFiles = [testResultsFiles];
        }

        if (!matchingTestResultsFiles || matchingTestResultsFiles.length === 0) {
            console.log(tl.loc('NoTestResults', testResultsFiles));
            return 0;
        }

        let tp = new tl.TestPublisher("JUnit");
        const testRunTitle = tl.getInput('testRunTitle');

        tp.publish(matchingTestResultsFiles, true, "", "", testRunTitle, true, TESTRUN_SYSTEM);
    }
}

function processAntOutputLine(line) {
    if (line == null) {
        return;
    }

    const javacText = "[javac] ";
    //[java] [javac] c:\path\to\file:100: error: error_msg
    const compileErrorFileRegexWin = /^(\[java\])?\s*\[javac\]\s*([^:]:[^:]+):(\d+):\s*(.+)$/
    //[java] [javac] /path/to/file:100: error: error_msg
    const compileErrorFileRegexUnix = /^(\[java\])?\s*\[javac\]\s*([^:]+):(\d+):\s*(.+)$/
    const compileErrorFileRegex = (isWindows) ? compileErrorFileRegexWin : compileErrorFileRegexUnix;

    let severity = null;
    if (line.indexOf(javacText) >= 0) {
        // parse javac errors and warnings
        const matches = compileErrorFileRegex.exec(line);
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

    function execEnableCodeCoverage(): Q.Promise<string> {
        return enableCodeCoverage()
            .then(function (resp) {
                tl.debug("Enabled code coverage successfully");
                return "CodeCoverage_9064e1d0";
            }).catch(function (err) {
                tl.warning("Failed to enable code coverage: " + err);
                return "";
            });
    };

    function enableCodeCoverage(): Q.Promise<any> {
        if (!isCodeCoverageOpted) {
            return Q.resolve(true);
        }

        const classFilter: string = tl.getInput('classFilter');
        const classFilesDirectories: string = tl.getInput('classFilesDirectories', true);
        const sourceDirectories: string = tl.getInput('srcDirectories');
        // appending with small guid to keep it unique. Avoiding full guid to ensure no long path issues.
        const reportDirectoryName = "CCReport43F6D5EF";
        reportDirectory = path.join(buildRootPath, reportDirectoryName);
        const reportBuildFileName = "CCReportBuildA4D283EG.xml";
        reportBuildFile = path.join(buildRootPath, reportBuildFileName);
        let summaryFileName = "";
        if (ccTool.toLowerCase() == "jacoco") {
            summaryFileName = "summary.xml";
        }else if (ccTool.toLowerCase() == "cobertura") {
            summaryFileName = "coverage.xml";
        }
        summaryFile = path.join(buildRootPath, reportDirectoryName, summaryFileName);
        const coberturaCCFile = path.join(buildRootPath, "cobertura.ser");
        let instrumentedClassesDirectory = path.join(buildRootPath, "InstrumentedClasses");

        // clean any previous reports.
        try {
            tl.rmRF(coberturaCCFile);
            tl.rmRF(reportDirectory);
            tl.rmRF(reportBuildFile);
            tl.rmRF(instrumentedClassesDirectory);
        } catch (err) {
            tl.debug("Error removing previous cc files: " + err);
        }

        let buildProps: { [key: string]: string } = {};
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

    async function publishCodeCoverage(codeCoverageOpted: boolean, ccReportTask: string) {
        tl.debug("publishCodeCoverage f=" + failIfCodeCoverageEmpty + " opt=" + codeCoverageOpted + " task=" + ccReportTask);
        if (failIfCodeCoverageEmpty && codeCoverageOpted && !ccReportTask) {
            throw tl.loc('NoCodeCoverage'); 
        }
        else if (codeCoverageOpted && ccReportTask) {
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
            antRunner.exec().then(async function (code) {
                if (failIfCodeCoverageEmpty && await ccUtils.isCodeCoverageFileEmpty(summaryFile, ccTool)) {
                    throw tl.loc('NoCodeCoverage'); 
                }
                if (pathExistsAsFile(summaryFile)) {
                    tl.debug("Summary file = " + summaryFile);
                    tl.debug("Report directory = " + reportDirectory);
                    tl.debug("Publishing code coverage results to TFS");
                    let ccPublisher = new tl.CodeCoveragePublisher();
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
        antb.line(tl.getInput('options', false));
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
        var javaTelemetryData = null;
        if (javaHomeSelection == 'JDKVersion') {
            tl.debug('Using JDK version to find and set JAVA_HOME');
            var jdkVersion = tl.getInput('jdkVersion');
            var jdkArchitecture = tl.getInput('jdkArchitecture');
            javaTelemetryData = { "jdkVersion": jdkVersion };
            
            if (jdkVersion != 'default') {
                specifiedJavaHome = javacommons.findJavaHome(jdkVersion, jdkArchitecture);
            }
        }
        else {
            tl.debug('Using path from user input to set JAVA_HOME');
            var jdkUserInputPath = tl.getPathInput('jdkUserInputPath', true, true);
            specifiedJavaHome = jdkUserInputPath;
            javaTelemetryData = { "jdkVersion": "custom" };
        }
        javacommons.publishJavaTelemetry('Ant', javaTelemetryData);
        
        if (specifiedJavaHome) {
            tl.debug('Set JAVA_HOME to ' + specifiedJavaHome);
            process.env['JAVA_HOME'] = specifiedJavaHome;
        }

        var ccTool = tl.getInput('codeCoverageTool');
        var isCodeCoverageOpted = (typeof ccTool != "undefined" && ccTool && ccTool.toLowerCase() != 'none');
        var failIfCodeCoverageEmpty: boolean = tl.getBoolInput('failIfCoverageEmpty');
        var buildRootPath = path.dirname(antBuildFile);

        var summaryFile: string = null;
        var reportDirectory: string = null;
        var ccReportTask: string = null;
        var reportBuildFile: string = null;
        var publishJUnitResults = tl.getInput('publishJUnitResults');
        var testResultsFiles = tl.getInput('testResultsFiles', true);
        var publishJUnitResults = tl.getInput('publishJUnitResults');
        var testResultsFiles = tl.getInput('testResultsFiles', true);

        ccReportTask = await execEnableCodeCoverage();

        await antv.exec();
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

        await antb.exec()
            .then(async function (code) {
                publishTestResults(publishJUnitResults, testResultsFiles);
                await publishCodeCoverage(isCodeCoverageOpted, ccReportTask);
                tl.setResult(tl.TaskResult.Succeeded, "Task succeeded");
            })
            .fail(function (err) {
                console.error(err.message);
                publishTestResults(publishJUnitResults, testResultsFiles);
                tl.debug('taskRunner fail');
                tl.setResult(tl.TaskResult.Failed, err);
            });
    } catch (e) {
        tl.debug(e.message);
        tl.error(e);
        tl.setResult(tl.TaskResult.Failed, e.message);
    }
}

doWork();

