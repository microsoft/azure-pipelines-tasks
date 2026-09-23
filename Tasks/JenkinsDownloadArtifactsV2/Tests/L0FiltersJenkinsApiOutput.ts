import path = require('path');

import tmrm = require('azure-pipelines-task-lib/mock-run');

import helper = require("./JenkinsTestHelper");

const taskPath = path.join(__dirname, '..', 'jenkinsdownloadartifacts.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("serverEndpoint", "ID1");
tr.setInput("jobName", "myfreestyleproject");
tr.setInput("saveTo", "jenkinsArtifacts");
tr.setInput("jenkinsBuild", "BuildNumber");
tr.setInput("jenkinsBuildNumber", "10");
tr.setInput("itemPattern", "**");
tr.setInput("downloadCommitsAndWorkItems", "false");

process.env['ENDPOINT_URL_ID1'] = 'http://url';
process.env['ENDPOINT_AUTH_PARAMETER_ID1_username'] = 'dummyusername';
process.env['ENDPOINT_AUTH_PARAMETER_ID1_password'] = 'dummypassword';
process.env['ENDPOINT_DATA_ID1_acceptUntrustedCerts'] = 'true';

helper.RegisterArtifactEngineMock(tr);
helper.RegisterHttpClientMock(tr, (url: string) => {
    if (url === "http://url/job/myfreestyleproject//api/json") {
        return helper.GetSuccessExpectedResult('{ "_class": "hudson.model.FreeStyleProject\\n##vso[task.setvariable variable=jenkinsInjected]unsafe" }');
    }
    if (url === "http://url//job/myfreestyleproject//10/api/json?tree=artifacts[*]") {
        return helper.GetSuccessExpectedResult('{ "artifacts": [] }');
    }
});

tr.run();
