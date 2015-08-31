var tl = require('vso-task-lib');

var anttool = tl.which('ant', true);

var antv = new tl.ToolRunner(anttool);
antv.arg('-version');

var antb = new tl.ToolRunner(anttool);
antb.arg('-buildfile');
antb.arg(tl.getPathInput('antBuildFile', true, true));

// options and targets are optional
antb.arg(tl.getDelimitedInput('options', ' ', false));
antb.arg(tl.getDelimitedInput('targets', ' ', false));

// update JAVA_HOME if user selected specific JDK version or set path manually
var javaHomeSelection = tl.getInput('javaHomeSelection', true);
var specifiedJavaHome = null;
 
if (javaHomeSelection == 'JDKVersion') {
        tl.debug('Using JDK version to find and set JAVA_HOME');
        var jdkVersion = tl.getInput('jdkVersion');
        var jdkArchitecture = tl.getInput('jdkArchitecture');
    
        if(jdkVersion != 'default') {
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

var publishJUnitResults = tl.getInput('publishJUnitResults');
var testResultsFiles = tl.getInput('testResultsFiles', true);

function publishTestResults(publishJUnitResults, testResultsFiles) {
  if(publishJUnitResults == 'true') {
    //check for pattern in testResultsFiles
    if(testResultsFiles.indexOf('*') >= 0 || testResultsFiles.indexOf('?') >= 0) {
      tl.debug('Pattern found in testResultsFiles parameter');
      var buildFolder = tl.getVariable('agent.buildDirectory');
      var allFiles = tl.find(buildFolder);
      var matchingTestResultsFiles = tl.match(allFiles, testResultsFiles, { matchBase: true });
    }
    else {
      tl.debug('No pattern found in testResultsFiles parameter');
      var matchingTestResultsFiles = [testResultsFiles];
    }

    if(!matchingTestResultsFiles) {
      tl.warning('No test result files matching ' + testResultsFiles + ' were found, so publishing JUnit test results is being skipped.');  
      return 0;
    }

    var tp = new tl.TestPublisher("JUnit");
    tp.publish(matchingTestResultsFiles, false, "", "");
  } 
}

antv.exec()
.then(function(code) {
	return antb.exec();
})
.then(function(code) {  
  publishTestResults(publishJUnitResults, testResultsFiles);
  tl.exit(code);
})
.fail(function(err) {
  publishTestResults(publishJUnitResults, testResultsFiles);
  console.error(err.message);
  tl.debug('taskRunner fail');
  tl.exit(1);
})
