/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import tl = require('vsts-task-lib/task');
import path = require('path');

var mvntool = '';
var mavenVersionSelection = tl.getInput('mavenVersionSelection', true);
if (mavenVersionSelection == 'Path') {
    tl.debug('Using maven path from user input');
    var mavenPath = tl.getPathInput('mavenPath', true, true);
    mvntool = path.join(mavenPath, 'bin/mvn');

    if (tl.getBoolInput('mavenSetM2Home')) {
        tl.setEnvVar("M2_HOME", mavenPath);
        tl.debug('M2_HOME set to ' + mavenPath)
    }
} else {
    tl.debug('Using maven from standard system path');
    mvntool = tl.which('mvn', true);
}
tl.debug('Maven binary: ' + mvntool);

var mavenPOMFile = tl.getPathInput('mavenPOMFile', true, true);
var mavenOptions = tl.getDelimitedInput('options', ' ', false);
var mavenGoals = tl.getDelimitedInput('goals', ' ', true);

var mvnv = tl.createToolRunner(mvntool);
mvnv.arg('-version');

var mvnb = tl.createToolRunner(mvntool);
mvnb.arg('-f');
mvnb.pathArg(mavenPOMFile);
mvnb.arg(mavenOptions);
mvnb.arg(mavenGoals);

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
} else {
    tl.debug('Using path from user input to set JAVA_HOME');
    var jdkUserInputPath = tl.getPathInput('jdkUserInputPath', true, true);
    specifiedJavaHome = jdkUserInputPath;
}

if (specifiedJavaHome) {
    tl.debug('Set JAVA_HOME to ' + specifiedJavaHome);
    process.env['JAVA_HOME'] = specifiedJavaHome;
}

var publishJUnitResults = tl.getInput('publishJUnitResults');
var testResultsFiles = tl.getInput('testResultsFiles', true);

function publishTestResults(publishJUnitResults, testResultsFiles: string) {
    if (publishJUnitResults == 'true') {
        //check for pattern in testResultsFiles
        if (testResultsFiles.indexOf('*') >= 0 || testResultsFiles.indexOf('?') >= 0) {
            tl.debug('Pattern found in testResultsFiles parameter');
            var buildFolder = tl.getVariable('agent.buildDirectory');
            var allFiles = tl.find(buildFolder);
            var matchingTestResultsFiles = tl.match(allFiles, testResultsFiles, {
                matchBase: true
            });
        } else {
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

function getSonarQubeRunner() {
    var sqAnalysisEnabled = tl.getInput('sqAnalysisEnabled', true);

    if (sqAnalysisEnabled != 'true') {
        console.log("SonarQube analysis is not enabled");
        return;
    }

    console.log("SonarQube analysis is enabled");
    var mvnsq;
    var sqEndpoint = getEndpointDetails("sqConnectedServiceName");
    var sqDbDetailsRequired = tl.getInput('sqDbDetailsRequired', true);

    if (sqDbDetailsRequired == 'true') {
        var sqDbUrl = tl.getInput('sqDbUrl', false);
        var sqDbUsername = tl.getInput('sqDbUsername', false);
        var sqDbPassword = tl.getInput('sqDbPassword', false);
        mvnsq = createMavenSQRunner(sqEndpoint.Url, sqEndpoint.Username, sqEndpoint.Password, sqDbUrl, sqDbUsername, sqDbPassword);
    } else {
        mvnsq = createMavenSQRunner(sqEndpoint.Url, sqEndpoint.Username, sqEndpoint.Password);
    }

    mvnsq.arg('-f');
    mvnsq.pathArg(mavenPOMFile);
    mvnsq.argString(mavenOptions); // add the user options to allow further customization of the SQ run
    mvnsq.arg("sonar:sonar");

    return mvnsq;
}

function getEndpointDetails(inputFieldName) {
    var errorMessage = "Could not decode the generic endpoint. Please ensure you are running the latest agent (min version 0.3.2)"
    if (!tl.getEndpointUrl) {
        throw new Error(errorMessage);
    }

    var genericEndpoint = tl.getInput(inputFieldName);
    if (!genericEndpoint) {
        throw new Error(errorMessage);
    }

    var hostUrl = tl.getEndpointUrl(genericEndpoint, false);
    if (!hostUrl) {
        throw new Error(errorMessage);
    }

    // Currently the username and the password are required, but in the future they will not be mandatory
    // - so not validating the values here
    var hostUsername = getAuthParameter(genericEndpoint, 'username');
    var hostPassword = getAuthParameter(genericEndpoint, 'password');
    tl.debug("hostUsername: " + hostUsername);

    return {
        "Url": hostUrl,
        "Username": hostUsername,
        "Password": hostPassword
    };
}

// The endpoint stores the auth details as JSON. Unfortunately the structure of the JSON has changed through time, namely the keys were sometimes upper-case.
// To work around this, we can perform case insensitive checks in the property dictionary of the object. Note that the PowerShell implementation does not suffer from this problem.
// See https://github.com/Microsoft/vso-agent/blob/bbabbcab3f96ef0cfdbae5ef8237f9832bef5e9a/src/agent/plugins/release/artifact/jenkinsArtifact.ts for a similar implementation
function getAuthParameter(endpoint, paramName) {

    var paramValue = null;
    var auth = tl.getEndpointAuthorization(endpoint, false);

    if (auth.scheme != "UsernamePassword") {
        throw new Error("The authorization scheme " + auth.scheme + " is not supported for a SonarQube endpoint. Please use a username and a password.");
    }

    var parameters = Object.getOwnPropertyNames(auth['parameters']);

    var keyName;
    parameters.some(function (key) {

        if (key.toLowerCase() === paramName.toLowerCase()) {
            keyName = key;

            return true;
        }
    });

    paramValue = auth['parameters'][keyName];

    return paramValue;
}

function createMavenSQRunner(sqHostUrl, sqHostUsername, sqHostPassword, sqDbUrl?, sqDbUsername?, sqDbPassword?) {
    var mvnsq = tl.createToolRunner(mvntool);

    mvnsq.arg('-Dsonar.host.url=' + sqHostUrl);
    if (sqHostUsername) {
        mvnsq.arg('-Dsonar.login=' + sqHostUsername);
    }
    if (sqHostPassword) {
        mvnsq.arg('-Dsonar.password=' + sqHostPassword);
    }
    if (sqDbUrl) {
        mvnsq.arg('-Dsonar.jdbc.url=' + sqDbUrl);
    }
    if (sqDbUsername) {
        mvnsq.arg('-Dsonar.jdbc.username=' + sqDbUsername);
    }
    if (sqDbPassword) {
        mvnsq.arg('-Dsonar.jdbc.password=' + sqDbPassword);
    }

    return mvnsq;
}

function processMavenOutput(data) {
    if(data == null) {
        return;
    }

    data = data.toString();
    var input = data;
    var severity = 'NONE';
    if(data.charAt(0) === '[') {
        var rightIndex = data.indexOf(']');
        if(rightIndex > 0) {
            severity = data.substring(1, rightIndex);

            if(severity === 'ERROR' || severity === 'WARNING') {
                // Try to match output like
                // /Users/user/agent/_work/4/s/project/src/main/java/com/contoso/billingservice/file.java:[linenumber, columnnumber] error message here
                // A successful match will return an array of 5 strings - full matched string, file path, line number, column number, error message
                input = input.substring(rightIndex + 1);
                var compileErrorsRegex = /([a-zA-Z0-9_ \-\/.]+):\[([0-9]+),([0-9]+)\](.*)/g;
                var matches = [];
                var match;
                while (match = compileErrorsRegex.exec(input.toString())) {
                    matches = matches.concat(match);
                }

                if(matches != null) {
                    var index = 0;
                    while (index + 4 < matches.length) {
                        tl.debug('full match = ' + matches[index + 0]);
                        tl.debug('file path = ' + matches[index + 1]);
                        tl.debug('line number = ' + matches[index + 2]);
                        tl.debug('column number = ' + matches[index + 3]);
                        tl.debug('message = ' + matches[index + 4]);

                        // task.issue is only for xplat agent and doesn't provide the sourcepath link on summary page
                        // we should use task.logissue when xplat agent is not used anymore so this will workon the coreCLR agent
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

/*
Maven task orchestration:
1. Check that maven exists 
2. Run maven with the user goals. Compilation or test errors will cause this to fail
3. Always try to publish tests results 
4. Always try to run the SonarQube analysis if it is enabled. In case the build has failed, the analysis 
will still succeed but the report will have less data. 
5. If #2 above failed, exit with an error code to mark the entire step as failed. Same for #4.
*/

var userRunFailed = false;
var sqRunFailed = false;

mvnv.exec()
.fail(function (err) {
    console.error("Maven is not installed on the agent");
    tl.exit(1);  // tl.exit sets the step result but does not stop execution
    process.exit(1);
})
.then(function (code) {
        //read maven stdout
        mvnb.on('stdout', function (data) {
            processMavenOutput(data);
        });
    return mvnb.exec(); // run Maven with the user specified goals
})
.fail(function (err) {
    console.error(err.message);
    userRunFailed = true; // record the error and continue
})
.then(function (code) {
    var mvnsq = getSonarQubeRunner();

    if (mvnsq) {
        // run Maven with the sonar:sonar goal, even if the user-goal Maven failed (e.g. test failures)
        // note that running sonar:sonar along with the user goals is not supported due to a SonarQube bug
        return mvnsq.exec()
    }
})
.fail(function (err) {
    console.error(err.message);
    console.error("SonarQube analysis failed");
    sqRunFailed = true;
})
.then(function () {
    // publish test results even if tests fail, causing Maven to fail;
    publishTestResults(publishJUnitResults, testResultsFiles);
    if (userRunFailed || sqRunFailed) {
        tl.exit(1); // mark task failure
    } else {
        tl.exit(0); // mark task success
    }

    // do not force an exit as publishing results is async and it won't have finished 
})
