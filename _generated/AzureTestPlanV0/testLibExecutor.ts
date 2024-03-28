import os = require('os');
import Q = require('q');
import fs = require('fs');
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as tr from 'azure-pipelines-task-lib/toolrunner';

var isWindows = os.type().match(/^Win/);

function getMavenExec() {
    var m2HomeEnvVar: string = null;
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

function getExecOptions(): tr.IExecOptions {
    var env = process.env;
    return <tr.IExecOptions>{
        env: env,
    };
}

/**Maven orchestration occurs as follows:
* 1. Check that Maven exists by executing it to retrieve its version.
* 2. Run Maven. Compilation or test errors will cause this to fail.
* 3. If #1 or #2 above failed, exit with an error code to mark the entire step as failed.
* @param args Arguments to execute via mvn
* @returns execution Status Code
*/
export async function execMavenBuild(args: string[]) {

    var mvnExec = getMavenExec();

    // Setup tool runner that executes Maven only to retrieve its version
    var mvnGetVersion = tl.tool(mvnExec);
    mvnGetVersion.arg('-version');

    // 1. Check that Maven exists by executing it to retrieve its version.
    await mvnGetVersion.exec()
        .fail(function (err) {
            console.error("Maven is not installed on the agent");
            tl.setResult(tl.TaskResult.Failed, "Maven is not installed."); // tl.exit sets the step result but does not stop execution
            process.exit(1);
        })
        .then(async function (code) {
            // Setup Maven Executable to run list of test runs provided as input
            var mvnRun = tl.tool(mvnExec);
            mvnRun.arg('-ntp');
            mvnRun.arg(args);

            // 3. Run Maven. Compilation or test errors will cause this to fail.
            return mvnRun.exec(getExecOptions());
        })
        .fail(function (err) {
            console.error(err.message);
            tl.setResult(tl.TaskResult.Failed, "Build failed."); // tl.exit sets the step result but does not stop execution
            process.exit(1);
        });
}

function getGradlewExec() {
    const gradlewExecFileSearchPattern: string[] = ["**/gradlew"];
    let workingDirectory = tl.getVariable('System.DefaultWorkingDirectory');

    if (tl.getVariable('System.DefaultWorkingDirectory') && (!path.isAbsolute(workingDirectory))) {
        workingDirectory = path.join(tl.getVariable('System.DefaultWorkingDirectory'), workingDirectory);
    }

    console.debug(workingDirectory);

    const findOptions = <tl.FindOptions>{
        allowBrokenSymbolicLinks: true,
        followSpecifiedSymbolicLink: true,
        followSymbolicLinks: true
    };

    const gradlewPath = tl.findMatch(workingDirectory, gradlewExecFileSearchPattern, findOptions);

    if (gradlewPath.length == 0) {
        tl.setResult(tl.TaskResult.Failed, "Missing gradlew file");
    }

    if (gradlewPath.length > 1) {
        tl.warning(tl.loc('MultipleMatchingGradlewFound'));
    }

    var gradlewExec: string = gradlewPath[0];

    if (isWindows) {
        tl.debug('Append .bat extension name to gradlew script.');
        gradlewExec += '.bat';
    }

    if (fs.existsSync(gradlewExec)) {
        try {
            // Make sure the wrapper script is executable
            fs.accessSync(gradlewExec, fs.constants.X_OK)
        } catch (err) {
            // If not, show warning and chmodding the gradlew file to make it executable
            tl.warning(tl.loc('chmodGradlew'));
            fs.chmodSync(gradlewExec, '755');
        }
    }

    return gradlewExec;
}

/** Gradle Orchestration via gradlew script
 * @param args Arguments to execute via mvn
 * @returns execution Status Code
 */
export async function execGradleBuild(args: string[]) {
    var gradleExec = getGradlewExec();

    // Setup tool runner that executes Maven only to retrieve its version
    var gradleRunner = tl.tool(gradleExec);

    // Add args prepared by invoker for executing individual test cases
    gradleRunner.arg('clean');
    gradleRunner.arg(args);

    var statusCode = await gradleRunner.exec(getExecOptions())
        .fail(function (err) {
            console.error(err.message);
            tl.setResult(tl.TaskResult.Failed, "Build failed."); // tl.exit sets the step result but does not stop execution
            process.exit(1);
        });

    return statusCode;
}