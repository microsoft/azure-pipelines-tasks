var path = require('path');
var tl = require('vso-task-lib');

var mvntool = tl.which('mvn', true);

var mavenPOMFile = tl.getPathInput('mavenPOMFile', true, true);
var mavenOptions = tl.getDelimitedInput('options', ' ', false);
var mavenGoals = tl.getDelimitedInput('goals', ' ', true);

var mvnv = new tl.ToolRunner(mvntool);
mvnv.arg('-version');

var mvnb = new tl.ToolRunner(mvntool);
mvnb.arg('-f');
mvnb.arg(mavenPOMFile);
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

function publishTestResults(publishJUnitResults, testResultsFiles) {
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
        tp.publish(matchingTestResultsFiles, false, "", "");
    }
}

function getSonarQubeRunner() {
    var sqAnalysisEnabled = tl.getInput('sqAnalysisEnabled', true);

    if (sqAnalysisEnabled != 'true') {
        console.log("SonarQube analysis is not enabled.");
        return;
    }

    console.log("SonarQube analysis is enabled");
    var sqArguments;
    var sqEndpoint = getEndpointDetails("sqConnectedServiceName");
    var sqDbDetailsRequired = tl.getInput('sqDbDetailsRequired', true);

    if (sqDbDetailsRequired == 'true') {
        var sqDbUrl = tl.getInput('sqDbUrl', false);
        var sqDbUsername = tl.getInput('sqDbUsername', false);
        var sqDbPassword = tl.getInput('sqDbPassword', false);
        sqArguments = createSonarQubeArgs(sqEndpoint.Url, sqEndpoint.Username, sqEndpoint.Password, sqDbUrl, sqDbUsername, sqDbPassword);
    } else {
        sqArguments = createSonarQubeArgs(sqEndpoint.Url, sqEndpoint.Username, sqEndpoint.Password);
    }

    sqArguments = mavenOptions + " " + sqArguments;
    tl.debug("Running Maven with goal sonar:sonar and options " + sqArguments);

    var mvnsq = new tl.ToolRunner(mvntool);
    mvnsq.arg('-f');
    mvnsq.arg(mavenPOMFile);
    mvnsq.arg(sqArguments);
    mvnsq.arg("sonar:sonar");

    return mvnsq;
}

function getEndpointDetails(inputFieldName) {
    var errorMessage = "Could not decode the generic endpoint. Please ensure you are running the latest agent (min version 0.3.0)"
    if (!tl.getEndpointUrl) {
        throw new Error(errorMessage);
    }

    var genericEndpoint = tl.getInput(inputFieldName);
    if (!genericEndpoint) {
        throw new Error(errorMessage);
    }

    hostUrl = tl.getEndpointUrl(genericEndpoint, false);
    var auth = tl.getEndpointAuthorization(genericEndpoint, false);

    if (auth.scheme != "UsernamePassword") {
        throw new Error("The authorization scheme " + auth.scheme + " is not supported for a SonarQube endpoint. Please use a username and a password.");
    }

    hostUsername = auth.parameters.Username;
    hostPassword = auth.parameters.Password;

    return {
        "Url": hostUrl,
        "Username": hostUsername,
        "Password": hostPassword
    };
}

function createSonarQubeArgs(sqHostUrl, sqHostUsername, sqHostPassword, sqDbUrl, sqDbUsername, sqDbPassword) {
    var sqArgs = "";
    if (sqHostUrl) {
        sqArgs += '-Dsonar.host.url="' + sqHostUrl + '" '
    }
    if (sqHostUsername) {
        sqArgs += '-Dsonar.login="' + sqHostUsername + '" '
    }
    if (sqHostPassword) {
        sqArgs += '-Dsonar.password="' + sqHostPassword + '" '
    }
    if (sqDbUrl) {
        sqArgs += '-Dsonar.jdbc.url="' + sqDbUrl + '" '
    }
    if (sqDbUsername) {
        sqArgs += '-Dsonar.jdbc.username="' + sqDbUsername + '" '
    }
    if (sqDbPassword) {
        sqArgs += '-Dsonar.jdbc.password="' + sqDbPassword + '" '
    }

    return sqArgs;
}

// Maven task orchestration

var runFailed = false;

mvnv.exec()
.then(function (code) {
    return mvnb.exec(); // run Maven with the user specified goals
})
.fail(function (err) {
    console.error(err.message);
    runFailed = true; // record the error, but do not exit
})
.fin(function () {
    publishTestResults(publishJUnitResults, testResultsFiles); // publish test results even if tests fail, causing Maven to fail
})
.then(function (code) {
    mvnsq = getSonarQubeRunner();

    if (mvnsq) {
        // run Maven with the sonar:sonar goal, even if the user-goal Maven failed (e.g. test failures)
        // note that running sonar:sonar along with the user goals is not supported due to a SonarQube bug
        return mvnsq.exec()  
    }
})
.fail(function (err) {
    console.error(err.message);
    console.error("SonarQube analysis failed");
    tl.exit(1)
})
.then(function (code) {
    if (runFailed) {
        tl.exit(1); // exit with a non-zero code to mark the entire task as having failed
    } else {
        tl.exit(code);
    }
});