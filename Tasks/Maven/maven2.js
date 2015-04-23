var tl = require('vso-task-lib');
var path = require('path');

var mvntool = tl.which('mvn', false);

var mvnv = new tl.ToolRunner(mvntool);
mvnv.arg('-version');

var mvnb = new tl.ToolRunner(mvntool);
mvnb.arg('-f');
mvnb.arg(tl.getPathInput('mavenPOMFile', true, true));

var options = tl.getInput('options');
if(options != '') {
  mvnb.arg(options);
}

var goals = tl.getInput('goals');
if(goals != '') {
  mvnb.arg(goals);
}

// update JAVA_HOME if user selected specific JDK version
var jdkVersion = tl.getInput('jdkVersion');
var jdkArchitecture = tl.getInput('jdkArchitecture');
if(jdkVersion != '' && jdkVersion != 'default') {
  // jdkVersion should be in the form of 1.7, 1.8, or 1.10
  // jdkArchitecture is either x64 or x86
  // envName for version 1.7 and x64 would be "JAVA_HOME_7_X64"
  var envName = "JAVA_HOME_" + jdkVersion.slice(2) + "_" + jdkArchitecture.toUpperCase();
  var specifiedJavaHome = tl.getVariable(envName);
  if (!specifiedJavaHome || specifiedJavaHome.length == 0) {
    tl.error('Failed to find specified JDK version.  Please make sure environment varialbe ' + envName + ' exists and is set to a valid JDK.');
    tl.exit(1);    
   }

   tl.debug('Set JAVA_HOME to ' + specifiedJavaHome);
   process.env['JAVA_HOME'] = specifiedJavaHome;
}


mvnv.exec()
.then(function(code) {
	return mvnb.exec();
})
.then(function(code) {
	tl.exit(code);
})
.fail(function(err) {
	tl.debug('taskRunner fail');
	tl.exit(1);
})
