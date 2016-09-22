/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require('fs');
import os = require('os');
import * as Q from "q";
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

function readJavaHomeFromRegistry(jdkVersion: string, arch: string): string {
    let javaHome = null;

    if (isWindows) {
        let reg = tl.tool('reg');
        reg.arg(['query', `HKLM\\SOFTWARE\\JavaSoft\\Java Development Kit\\${jdkVersion}`, "/v", "JavaHome"]);
        if (arch.toLowerCase() === "x86") {
            reg.arg("/reg:32");
        } else {
            reg.arg("/reg:64");
        }

        let result = reg.execSync({
            ignoreReturnCode: true
        });

        if (result && result.code === 0 && result.stdout) {
            let regSzIdx = result.stdout.indexOf("REG_SZ");
            if (regSzIdx > -1) {
                let output: string[] = result.stdout.split("REG_SZ");
                if (output.length === 2) {
                    javaHome = output[1].trim(); // value is what comes after
                    tl.debug("JAVA_HOME: " + javaHome);
                }
            }
        }
    }

    return javaHome;
}

async function doWork() {

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
                    if (isWindows) {
                        // attempt to discover java home property from registry on Windows
                        specifiedJavaHome = readJavaHomeFromRegistry(jdkVersion, jdkArchitecture);
                    } 
                    
                    if (!specifiedJavaHome) {
                        throw new Error('Failed to find specified JDK version. Please make sure environment variable ' + envName + ' exists and is set to the location of a corresponding JDK.');
                    }
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
        var publishJUnitResults = tl.getInput('publishJUnitResults');
        var testResultsFiles = tl.getInput('testResultsFiles', true);

        if(isCodeCoverageOpted){
            tl.warning('We are discontinuing the support of Automated code coverage report generation for Ant projects. Please refer https://github.com/Microsoft/vsts-tasks/blob/master/Tasks/ANT/README.md for more details.');
        }

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

        antb.exec()
            .then(function (code) {
                publishTestResults(publishJUnitResults, testResultsFiles);
                tl.setResult(tl.TaskResult.Succeeded, "Task succeeded");
            })
            .fail(function (err) {
                console.error(err.message);
                tl.debug('taskRunner fail');
                tl.setResult(tl.TaskResult.Failed, err);
            });
    } catch (e) {
        tl.debug(e.message);
        tl._writeError(e);
        tl.setResult(tl.TaskResult.Failed, e.message);
    }
}

doWork();

