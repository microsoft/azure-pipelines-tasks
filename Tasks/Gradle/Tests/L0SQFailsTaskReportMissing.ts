import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'gradletask.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

 //escape for Windows directories
let tempDir: string = path.join(__dirname, '_temp');
let sqAnalysisDirReplaced: string = path.join(tempDir, '.sqAnalysis').replace(/\\/g, '/');
let taskReportValidDir: string = __dirname;
let taskReportValidBuildDir: string = path.join(taskReportValidDir, 'build');
let taskReportValidBuildDirReplaced: string = path.join(taskReportValidDir, 'build').replace(/\\/g, '/');
let taskReportValidBuildSonarDir: string = path.join(taskReportValidBuildDir, 'sonar');
let taskReportValidBuildSonarDirReplaced: string = path.join(taskReportValidBuildDir, 'sonar').replace(/\\/g, '/');
let taskReportValidBuildSonarReportTaskTextDirReplaced: string = path.join(taskReportValidBuildSonarDir, 'report-task.txt').replace(/\\/g, '/');
let ccReportDirReplaced: string = path.join(__dirname, 'CCReport43F6D5EF', 'coverage.xml').replace(/\\/g, '/');

//Env vars in the mock framework must replace '.' with '_'
//replace with mock of setVariable when task-lib has the support
process.env['MOCK_IGNORE_TEMP_PATH'] = true;
process.env['MOCK_TEMP_PATH'] = path.join(__dirname, '..', '..');
process.env['MOCK_NORMALIZE_SLASHES'] = true;

process.env['JAVA_HOME_8_X86'] = '/user/local/bin/Java8';
process.env['System_DefaultWorkingDirectory'] = '/user/build/s';
process.env['ENDPOINT_URL_ID1'] = 'http://sonarqube/end/point';
process.env['ENDPOINT_AUTH_ID1'] = '{\"scheme\":\"UsernamePassword\", \"parameters\": {\"username\": \"uname\", \"password\": \"pword\"}}';
process.env['build_buildNumber'] = '14';
process.env['build_sourcesDirectory'] = `${taskReportValidDir}`;
process.env['build_artifactStagingDirectory'] = `${tempDir}`;

tr.setInput('wrapperScript', 'gradlew');
tr.setInput('options', '');
tr.setInput('tasks', 'build');
tr.setInput('javaHomeSelection', 'JDKVersion');
tr.setInput('jdkVersion', 'default');
tr.setInput('publishJUnitResults', 'true');
tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');

tr.setInput('sqAnalysisEnabled', 'true');
tr.setInput('sqConnectedServiceName', 'ID1');
tr.setInput('sqProjectName', 'test_sqProjectName');
tr.setInput('sqProjectKey', 'test_sqProjectKey');
tr.setInput('sqProjectVersion', 'test_sqProjectVersion');

//construct a string that is JSON, call JSON.parse(string), send that to ma.TaskLibAnswers
let myAnswers: string = `{
   "exec":{
      "gradlew build sonarqube -I /Gradle/CodeAnalysis/sonar.gradle -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.projectName=test_sqProjectName -Dsonar.projectKey=test_sqProjectKey -Dsonar.projectVersion=test_sqProjectVersion":{
         "code":0,
         "stdout":"Gradle build and SQ analysis done"
      },
      "gradlew.bat build sonarqube -I /Gradle/CodeAnalysis/sonar.gradle -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.projectName=test_sqProjectName -Dsonar.projectKey=test_sqProjectKey -Dsonar.projectVersion=test_sqProjectVersion":{
         "code":0,
         "stdout":"Gradle build and SQ analysis done"
      }
   },
   "checkPath":{
      "gradlew":true,
      "gradlew.bat":true,
      "/home/repo/src":true,
      "${sqAnalysisDirReplaced}":true,
      "${taskReportValidBuildDirReplaced}":true,
      "${taskReportValidBuildSonarDirReplaced}":true,
      "${taskReportValidBuildSonarReportTaskTextDirReplaced}":true
   },
   "stats":{
      "${ccReportDirReplaced}":{
         "isFile":true
      },
      "${sqAnalysisDirReplaced}":{
         "isFile":true
      },
      "${taskReportValidBuildDirReplaced}":{
         "isFile":true
      },
      "${taskReportValidBuildSonarDirReplaced}":{
         "isFile":true
      },
      "${taskReportValidBuildSonarReportTaskTextDirReplaced}":{
         "isFile":true
      }
   },
   "exist":{
      "${sqAnalysisDirReplaced}":true,
      "${taskReportValidBuildDirReplaced}":true,
      "${taskReportValidBuildSonarDirReplaced}":true,
      "${taskReportValidBuildSonarReportTaskTextDirReplaced}":true
   },
   "mkdirP":{
      "${sqAnalysisDirReplaced}":true,
      "${taskReportValidBuildDirReplaced}":true,
      "${taskReportValidBuildSonarDirReplaced}":true,
      "${taskReportValidBuildSonarReportTaskTextDirReplaced}":true
   }
}`;

let json: any = JSON.parse(myAnswers);

// Cast the json blob into a TaskLibAnswers
tr.setAnswers(<ma.TaskLibAnswers>json);

tr.run();
