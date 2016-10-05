import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require('fs');
import os = require('os');
import * as Q from "q";
import javacommons = require('java-common/java-common');
import ffl = require('find-files-legacy/findfiles.legacy');

tl.setResourcePath(path.join(__dirname, 'task.json'));

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
        let matchingTestResultsFiles = ffl.findFiles(testResultsFiles, false, tl.getVariable('System.DefaultWorkingDirectory'));
        if (!matchingTestResultsFiles || matchingTestResultsFiles.length == 0) {
            tl.warning('No test result files matching ' + testResultsFiles + ' were found, so publishing JUnit test results is being skipped.');
            return 0;
        }

        let tp = new tl.TestPublisher("JUnit");
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
                specifiedJavaHome = javacommons.findJavaHome(jdkVersion, jdkArchitecture);
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
            tl.warning(tl.loc('DiscontinueAntCodeCoverage'));
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

