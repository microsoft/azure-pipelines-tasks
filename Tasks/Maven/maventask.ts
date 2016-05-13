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
var mavenOptions = tl.getInput('options', false); // options can have spaces and quotes so we need to treat this as one string and not try to parse it
var mavenGoals = tl.getDelimitedInput('goals', ' ', true); // This assumes that goals cannot contain spaces

var mvnv = tl.createToolRunner(mvntool);
mvnv.arg('-version');

var mvnb = tl.createToolRunner(mvntool);
mvnb.arg('-f');
mvnb.pathArg(mavenPOMFile);
mvnb.argString(mavenOptions);
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

var ccTool = tl.getInput('codeCoverageTool');
var isCodeCoverageOpted = (typeof ccTool != "undefined" && ccTool && ccTool.toLowerCase() != 'none');

if (isCodeCoverageOpted) {
    var classFilter = tl.getInput('classFilter');
    var classFilesDirectories = tl.getInput('classFilesDirectories');
    var sourceDirectories = tl.getInput('srcDirectories');
    var buildRootPath = path.dirname(mavenPOMFile);
    // appending with small guid to keep it unique. Avoiding full guid to ensure no long path issues.
    var reportPOMFileName = "CCReportPomA4D283EG.xml";
    var reportPOMFile = path.join(buildRootPath, reportPOMFileName);
    var targetDirectory = path.join(buildRootPath, "target");
    var ccReportTask = "jacoco:report";

    if (ccTool.toLowerCase() == "jacoco") {
        var reportDirectoryName = "CCReport43F6D5EF";
        var summaryFileName = "jacoco.xml";
    }
    else if (ccTool.toLowerCase() == "cobertura") {
        var reportDirectoryName = "target/site/cobertura";
        var summaryFileName = "coverage.xml";
    }

    var reportDirectory = path.join(buildRootPath, reportDirectoryName);
    var summaryFile = path.join(reportDirectory, summaryFileName);

    if (ccTool.toLowerCase() == "jacoco") {
        var execFileJacoco = path.join(reportDirectory, "jacoco.exec");
    }    
        
    // clean any previously generated files.
    if (isDirectoryExists(targetDirectory)) {
        tl.rmRF(targetDirectory);
    }
    if (isDirectoryExists(reportDirectory)) {
        tl.rmRF(reportDirectory);
    }
    if (isFileExists(reportPOMFile)) {
        tl.rmRF(reportPOMFile);
    }

    enableCodeCoverage();
}
else {
    tl.debug("Option to enable code coverage was not selected and is being skipped.");
}

var publishJUnitResults = tl.getInput('publishJUnitResults');
var testResultsFiles = tl.getInput('testResultsFiles', true);

function publishTestResults(publishJUnitResults, testResultsFiles: string) {
    var matchingTestResultsFiles: string[] = undefined;
    if (publishJUnitResults == 'true') {
        //check for pattern in testResultsFiles
        if (testResultsFiles.indexOf('*') >= 0 || testResultsFiles.indexOf('?') >= 0) {
            tl.debug('Pattern found in testResultsFiles parameter');
            var buildFolder = tl.getVariable('agent.buildDirectory');
            tl.debug(`buildFolder=${buildFolder}`);
            var allFiles = tl.find(buildFolder);
            matchingTestResultsFiles = tl.match(allFiles, testResultsFiles, {
                matchBase: true
            });
        } else {
            tl.debug('No pattern found in testResultsFiles parameter');
            matchingTestResultsFiles = [testResultsFiles];
        }

        if (!matchingTestResultsFiles || matchingTestResultsFiles.length == 0) {
            tl.warning('No test result files matching ' + testResultsFiles + ' were found, so publishing JUnit test results is being skipped.');
            return 0;
        }

        var tp = new tl.TestPublisher("JUnit");
        tp.publish(matchingTestResultsFiles, true, "", "", "", true);
    }
}

function enableCodeCoverage() {
    var buildProps: { [key: string]: string } = {};
    buildProps['buildfile'] = mavenPOMFile;
    buildProps['classfilter'] = classFilter
    buildProps['classfilesdirectories'] = classFilesDirectories;
    buildProps['sourcedirectories'] = sourceDirectories;
    buildProps['summaryfile'] = summaryFile;
    buildProps['reportdirectory'] = reportDirectory;
    buildProps['reportbuildfile'] = reportPOMFile;

    try {
        var codeCoverageEnabler = new tl.CodeCoverageEnabler('Maven', ccTool);
        codeCoverageEnabler.enableCodeCoverage(buildProps);
        tl.debug("Code coverage is successfully enabled.");
    }
    catch (Error) {
        tl.warning("Enabling code coverage failed. Check the build logs for errors.");
    }
}

function publishCodeCoverage(isCodeCoverageOpted: boolean) {
    if (isCodeCoverageOpted) {
        tl.debug("Collecting code coverage reports");

        if (ccTool.toLowerCase() == "jacoco") {
            var mvnReport = tl.createToolRunner(mvntool);
            mvnReport.arg('-f');
            if (isFileExists(reportPOMFile)) {
                // multi module project
                mvnReport.pathArg(reportPOMFile);
                mvnReport.arg("verify");
            }
            else {
                mvnReport.pathArg(mavenPOMFile);
                mvnReport.arg(ccReportTask);
            }
            mvnReport.exec().then(function(code) {
                publishCCToTfs();
            }).fail(function(err) {
                tl.warning("No code coverage found to publish. There might be a build failure resulting in no code coverage or there might be no tests.");
            });
        }
        else if (ccTool.toLowerCase() == "cobertura") {
            publishCCToTfs();
        }
    }
}

function publishCCToTfs() {
    if (isFileExists(summaryFile)) {
        tl.debug("Summary file = " + summaryFile);
        tl.debug("Report directory = " + reportDirectory);
        tl.debug("Publishing code coverage results to TFS");
        var ccPublisher = new tl.CodeCoveragePublisher();
        ccPublisher.publish(ccTool, summaryFile, reportDirectory, "");
    }
    else {
        tl.warning("No code coverage found to publish. There might be a build failure resulting in no code coverage or there might be no tests.");
    }
}

function isFileExists(path: string) {
    try {
        return tl.stats(path).isFile();
    }
    catch (error) {
        return false;
    }
}

function isDirectoryExists(path: string) {
    try {
        return tl.stats(path).isDirectory();
    }
    catch (error) {
        return false;
    }
}

function getSonarQubeRunner() {
    if (!tl.getBoolInput('sqAnalysisEnabled')) {
        console.log("SonarQube analysis is not enabled");
        return;
    }

    console.log("SonarQube analysis is enabled");
    var mvnsq;
    var sqEndpoint = getEndpointDetails("sqConnectedServiceName");

    if (tl.getBoolInput('sqDbDetailsRequired')) {
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
    parameters.some(function(key) {

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
    if (execFileJacoco) {
        mvnsq.arg('-Dsonar.jacoco.reportPath=' + execFileJacoco);
    }

    return mvnsq;
}

function processMavenOutput(data) {
    if (data == null) {
        return;
    }

    data = data.toString();
    var input = data;
    var severity = 'NONE';
    if (data.charAt(0) === '[') {
        var rightIndex = data.indexOf(']');
        if (rightIndex > 0) {
            severity = data.substring(1, rightIndex);

            if (severity === 'ERROR' || severity === 'WARNING') {
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

                if (matches != null) {
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
    .fail(function(err) {
        console.error("Maven is not installed on the agent");
        tl.exit(1);  // tl.exit sets the step result but does not stop execution
        process.exit(1);
    })
    .then(function(code) {
        //read maven stdout
        mvnb.on('stdout', function(data) {
            processMavenOutput(data);
        });
        return mvnb.exec(); // run Maven with the user specified goals
    })
    .fail(function(err) {
        console.error(err.message);
        userRunFailed = true; // record the error and continue
    })
    .then(function(code) {
        var mvnsq = getSonarQubeRunner();

        if (mvnsq) {
            // run Maven with the sonar:sonar goal, even if the user-goal Maven failed (e.g. test failures)
            // note that running sonar:sonar along with the user goals is not supported due to a SonarQube bug
            return mvnsq.exec()
        }
    })
    .fail(function(err) {
        console.error(err.message);
        console.error("SonarQube analysis failed");
        sqRunFailed = true;
    })
    .then(function() {
        // publish test results even if tests fail, causing Maven to fail;
        publishTestResults(publishJUnitResults, testResultsFiles);
        publishCodeCoverage(isCodeCoverageOpted);
        if (userRunFailed || sqRunFailed) {
            tl.exit(1); // mark task failure
        } else {
            tl.exit(0); // mark task success
        }

        // do not force an exit as publishing results is async and it won't have finished 
    })