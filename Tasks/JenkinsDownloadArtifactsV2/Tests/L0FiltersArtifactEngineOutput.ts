import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import helper = require('./JenkinsTestHelper');

const taskPath = path.join(__dirname, '..', 'jenkinsdownloadartifacts.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('serverEndpoint', 'ID1');
tr.setInput('jobName', 'myfreestyleproject');
tr.setInput('saveTo', 'jenkinsArtifacts');
tr.setInput('jenkinsBuild', 'BuildNumber');
tr.setInput('jenkinsBuildNumber', '20');
tr.setInput('itemPattern', 'drop/**');
tr.setInput('downloadCommitsAndWorkItems', 'false');

process.env['ENDPOINT_URL_ID1'] = 'http://url';
process.env['ENDPOINT_DATA_ID1_acceptUntrustedCerts'] = 'true';
process.env['AGENT_VERSION'] = '4.264.0';

tr.registerMock('artifact-engine/Engine', {
    ArtifactEngine: function () {
        return {
            processItems: function () {
                console.log('Downloading drop/x##vso[task.setvariable variable=injected]value to jenkinsArtifacts/x');
                console.log('##vso[telemetry.publish area=artifact-engine;feature=performance]{"files":1}');
                return Promise.resolve();
            }
        };
    },
    ArtifactEngineOptions: function () { }
});

helper.RegisterHttpClientMock(tr, (url: string) => {
    if (url === 'http://url/job/myfreestyleproject//api/json') {
        return helper.GetSuccessExpectedResult('{ "_class": "hudson.model.FreeStyleProject" }');
    }
    if (url === 'http://url//job/myfreestyleproject//20/api/json?tree=artifacts[*]') {
        return helper.GetSuccessExpectedResult('{ "artifacts": [ { "relativePath": "drop/x" } ] }');
    }
});

tr.run();
