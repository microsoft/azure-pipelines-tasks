import os = require('os');
import Q = require('q');
import path = require('path');
import fs = require('fs');
import * as tl from 'azure-pipelines-task-lib/task';
import * as tr from 'azure-pipelines-task-lib/toolrunner';

var isWindows = os.type().match(/^Win/);
var m2HomeEnvVar: string = null;
var mavenPOMFile: string = tl.getPathInput('mavenPOMFile', true, true);

function getMavenExec(){
    var mvnExec: string = '';
    m2HomeEnvVar = tl.getVariable('M2_HOME');
    if (m2HomeEnvVar) {
        tl.debug('Using M2_HOME environment variable value for Maven path: ' + m2HomeEnvVar);
        mvnExec = path.join(m2HomeEnvVar, 'bin', 'mvn');
    }
    // Second, look for Maven in the system path
    else {
        tl.debug('M2_HOME environment variable is not set, so Maven will be sought in the system path');
        mvnExec = tl.which('mvn', true);
    }

    if (isWindows &&
        !mvnExec.toLowerCase().endsWith('.cmd') &&
        !mvnExec.toLowerCase().endsWith('.bat')) {
        if (tl.exist(mvnExec + '.cmd')) {
            // Maven 3 uses mvn.cmd
            mvnExec += '.cmd';
        }
        else if (tl.exist(mvnExec + '.bat')) {
            // Maven 2 uses mvn.bat
            mvnExec += '.bat';
        }
    }

    tl.checkPath(mvnExec, 'maven path');
    tl.debug('Maven executable: ' + mvnExec);

    return mvnExec;
}

let currentPlugin = '';

function processCurrentPluginFromOutput(data: string) {
    if (data.substring(0, 3) === '<<<') {
        const pluginData = data.substring(4);
        const colonIndex = pluginData.indexOf(":");
        currentPlugin = pluginData.substring(0, colonIndex)

        tl.debug(`Current plugin = ${currentPlugin}`);
    }
}


function processMavenOutput(buffer: Buffer) {
    if (buffer == null) {
        return;
    }

    const input = buffer.toString().trim();

    if (input.charAt(0) === '[') {
        const rightBraceIndex = buffer.indexOf(']');
        if (rightBraceIndex > 0) {
            const severity = input.substring(1, rightBraceIndex);
            if (severity === 'INFO') {
                const infoData = input.substring(rightBraceIndex + 1).trim();
                processCurrentPluginFromOutput(infoData);
            } else if (severity === 'ERROR' || severity === 'WARNING') {
                // Try to match Posix output like:
                // /Users/user/agent/_work/4/s/project/src/main/java/com/contoso/billingservice/file.java:[linenumber, columnnumber] error message here
                // or Windows output like:
                // /C:/a/1/s/project/src/main/java/com/contoso/billingservice/file.java:[linenumber, columnnumber] error message here
                // A successful match will return an array of 5 strings - full matched string, file path, line number, column number, error message
                const data = input.substring(rightBraceIndex + 1);
                let match: any;
                let matches: any[] = [];
                const compileErrorsRegex = isWindows ? /\/([^:]+:[^:]+):\[([\d]+),([\d]+)\](.*)/g   //Windows path format - leading slash with drive letter
                    : /([a-zA-Z0-9_ \-\/.]+):\[([0-9]+),([0-9]+)\](.*)/g;  // Posix path format
                while (match = compileErrorsRegex.exec(data)) {
                    matches = matches.concat(match);
                }

                if (matches != null) {
                    let index: number = 0;
                    while (index + 4 < matches.length) {
                        tl.debug('full match = ' + matches[index + 0]);
                        tl.debug('file path = ' + matches[index + 1]);
                        tl.debug('line number = ' + matches[index + 2]);
                        tl.debug('column number = ' + matches[index + 3]);
                        tl.debug('message = ' + matches[index + 4]);

                        // task.issue is only for the xplat agent and doesn't provide the sourcepath link on the summary page.
                        // We should use task.logissue when the xplat agent is retired so this will work on the CoreCLR agent.
                        tl.command('task.issue', {
                            type: severity.toLowerCase(),
                            sourcepath: matches[index + 1],
                            linenumber: matches[index + 2],
                            columnnumber: matches[index + 3]
                        }, matches[index + 0]);

                        index = index + 5;
                    }
                }
            }
        }
    }
}

function getExecOptions(): tr.IExecOptions {
    var env = process.env;
    return <tr.IExecOptions> {
        env: env,
    };
}

export async function execBuild(args: string[]) {
    // Maven task orchestration occurs as follows:
    // 1. Check that Maven exists by executing it to retrieve its version.
    // 2. Apply any goals for static code analysis tools selected by the user.
    // 3. Run Maven. Compilation or test errors will cause this to fail.
    //    In case the build has failed, the analysis will still succeed but the report will have less data. 
    // 4. Attempt to collate and upload static code analysis build summaries and artifacts.
    // 5. Always publish test results even if tests fail, causing this task to fail.
    // 6. If #3 or #4 above failed, exit with an error code to mark the entire step as failed.

    var userRunFailed: boolean = false;

    var mvnExec = getMavenExec();

    // Setup tool runner that executes Maven only to retrieve its version
    var mvnGetVersion = tl.tool(mvnExec);
    mvnGetVersion.arg('-version');

    // 1. Check that Maven exists by executing it to retrieve its version.
    let settingsXmlFile: string = null;
    await mvnGetVersion.exec()
        .fail(function (err) {
            console.error("Maven is not installed on the agent");
            tl.setResult(tl.TaskResult.Failed, "Build failed."); // tl.exit sets the step result but does not stop execution
            process.exit(1);
        })
        .then(async function (code) {
            // Setup tool runner to execute Maven goals
            var mvnRun = tl.tool(mvnExec);
            mvnRun.arg('-f');
            mvnRun.arg(mavenPOMFile);

            mvnRun.arg(args);

            // Read Maven standard output
            mvnRun.on('stdout', function (data: Buffer) {
                processMavenOutput(data);
            });

            // 3. Run Maven. Compilation or test errors will cause this to fail.
            return mvnRun.exec(getExecOptions());
        })
        .fail(function (err) {
            console.error(err.message);
            userRunFailed = true; // Record the error and continue
        });
}