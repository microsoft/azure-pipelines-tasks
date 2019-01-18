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
tr.setInput("jenkinsBuildNumber", "20");
tr.setInput("itemPattern", "archive/**");
tr.setInput("downloadCommitsAndWorkItems", "true");
tr.setInput("artifactDetailsFileNameSuffix", "alias_v1.json");

process.env['ENDPOINT_URL_ID1'] = 'http://url';
process.env['ENDPOINT_AUTH_PARAMETER_connection1_username'] = 'dummyusername';
process.env['ENDPOINT_AUTH_PARAMETER_connection1_password'] = 'dummypassword';
process.env['ENDPOINT_DATA_ID1_acceptUntrustedCerts'] = 'true';

helper.RegisterArtifactEngineMock(tr);
helper.RegisterHttpClientMock(tr, (url: string) => {
    if (url === "http://url/job/myfreestyleproject//api/json") {
        return helper.GetSuccessExpectedResult('{}');
    }

    if (url === "http://url//job/myfreestyleproject//20/api/json?tree=artifacts[*]") {
        return helper.GetSuccessExpectedResult('{ "_class": "hudson.model.FreeStyleBuild", "artifacts": [ "abc" ] }');
    }

    var commitResult = '{"actions":[{"remoteUrls":["http://bitbucket.org"]}],"changeSet":{"items": [{"commitId": "3cbfc14e3f482a25e5122323f3273b89677d9875", "author": { "fullName": "user" }, "msg": "test3", "date": "2018-07-07 12:18:48 +0530" }], "kind": "git"}}'
    if (url == "http://url/job/myfreestyleproject//20/api/json?tree=number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]") {
        return helper.GetSuccessExpectedResult(commitResult);
    }
});

tr.run();
