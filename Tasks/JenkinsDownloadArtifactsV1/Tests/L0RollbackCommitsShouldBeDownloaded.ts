import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import mockTask = require('vsts-task-lib/mock-task');
import helper = require("./JenkinsTestHelper");

const taskPath = path.join(__dirname, '..', 'jenkinsdownloadartifacts.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("serverEndpoint", "ID1");
tr.setInput("jobName", "myfreestyleproject")
tr.setInput("saveTo", "jenkinsArtifacts");
tr.setInput("filePath", "/");
tr.setInput("jenkinsBuild", "BuildNumber");
tr.setInput("jenkinsBuildNumber", "15");
tr.setInput("itemPattern", "archive/**");
tr.setInput("downloadCommitsAndWorkItems", "true");
tr.setInput("startJenkinsBuildNumber", "20"); // greater than jenkinsBuildNumber
tr.setInput("artifactDetailsFileNameSuffix", "alias_v1.json");

process.env['ENDPOINT_URL_ID1'] = 'http://url';
process.env['ENDPOINT_AUTH_PARAMETER_connection1_username'] = 'dummyusername';
process.env['ENDPOINT_AUTH_PARAMETER_connection1_password'] = 'dummypassword';
process.env['ENDPOINT_DATA_ID1_acceptUntrustedCerts'] = 'true';

helper.RegisterArtifactEngineMock(tr);
helper.RegisterHttpClientMock(tr, (url: string) => {
    if (url.indexOf('allBuilds[number]') !== -1) {
        return helper.GetSuccessExpectedResult('{"allBuilds":[{"number":22},{"number":21},{"number":20},{"number":18},{"number":15},{"number":14},{"number":13}]}');
    }

    if (url === "http://url/job/myfreestyleproject//api/json") {
        return helper.GetSuccessExpectedResult('{}');
    }

    if (url === "http://url//job/myfreestyleproject//15/api/json?tree=artifacts[*]") {
        return helper.GetSuccessExpectedResult('{ "_class": "hudson.model.FreeStyleBuild", "artifacts": [ "abc" ] }');
    }
});

tr.run();
