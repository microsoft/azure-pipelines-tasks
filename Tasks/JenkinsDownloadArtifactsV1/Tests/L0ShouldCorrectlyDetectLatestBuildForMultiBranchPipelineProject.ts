import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import mockTask = require('azure-pipelines-task-lib/mock-task');
import helper = require("./JenkinsTestHelper");

const taskPath = path.join(__dirname, '..', 'jenkinsdownloadartifacts.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("serverEndpoint", "ID1");
tr.setInput("jobName", "mymultibranchproject")
tr.setInput("saveTo", "jenkinsArtifacts");
tr.setInput("filePath", "/");
tr.setInput("jenkinsBuild", "LastSuccessfulBuild");
//tr.setInput("jenkinsBuildNumber", "10"); No explicit build number set
tr.setInput("itemPattern", "**");
tr.setInput("downloadCommitsAndWorkItems", "false");

process.env['ENDPOINT_URL_ID1'] = 'http://url';
process.env['ENDPOINT_AUTH_PARAMETER_connection1_username'] = 'dummyusername';
process.env['ENDPOINT_AUTH_PARAMETER_connection1_password'] = 'dummypassword';
process.env['ENDPOINT_DATA_ID1_acceptUntrustedCerts'] = 'true';

helper.RegisterArtifactEngineMock(tr);
helper.RegisterHttpClientMock(tr, (url: string) => {
    if (url === "http://url/job/mymultibranchproject//api/json") {
      return helper.GetSuccessExpectedResult('{ "_class": "org.jenkinsci.plugins.workflow.multibranch.WorkflowMultiBranchProject" }');
    };

    if (url === "http://url/job/mymultibranchproject//api/json?tree=jobs[name,lastSuccessfulBuild[id,displayName,timestamp]]") {
      return helper.GetSuccessExpectedResult(`
      {
        "jobs": [
          {
            "name": "master",
            "lastSuccessfulBuild": {
              "displayName": "#4",
              "id": "4",
              "timestamp": 1505833256600
            }
          },
          {
            "name": "branch1",
            "lastSuccessfulBuild": {
              "displayName": "#200",
              "id": "200",
              "timestamp": 1509900296722
            }
          },
          {
            "name": "branch2",
            "lastSuccessfulBuild": {
              "displayName": "#4",
              "id": "4",
              "timestamp": 1506054333275
            }
          }
        ]
      }`);
    }
});

tr.run();
