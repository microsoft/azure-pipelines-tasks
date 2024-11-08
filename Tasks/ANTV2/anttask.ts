import * as os from 'os';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';

import * as javacommons from 'azure-pipelines-tasks-java-common/java-common';

tl.setResourcePath(path.join(__dirname, 'task.json'));

const TESTRUN_SYSTEM = "VSTS - ant";
const isWindows = os.type().match(/^Win/);


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

        tp.publish(matchingTestResultsFiles, 'true', "", "", testRunTitle, 'true', TESTRUN_SYSTEM);
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


        var publishJUnitResults = tl.getInput('publishJUnitResults');
        var testResultsFiles = tl.getInput('testResultsFiles', true);

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

