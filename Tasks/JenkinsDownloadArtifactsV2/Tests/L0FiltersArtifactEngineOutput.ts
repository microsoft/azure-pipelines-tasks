import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import helper = require('./JenkinsTestHelper');

const taskPath = path.join(__dirname, '..', 'jenkinsdownloadartifacts.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('serverEndpoint', 'ID1');
tr.setInput('jobName', 'myfreestyleproject##vso[task.complete result=Failed]');
tr.setInput('saveTo', 'jenkinsArtifacts');
tr.setInput('jenkinsBuild', 'BuildNumber');
tr.setInput('jenkinsBuildNumber', '20');
tr.setInput('itemPattern', 'drop/**');
tr.setInput('downloadCommitsAndWorkItems', 'true');

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
    if (url.endsWith('//api/json')) {
        return helper.GetSuccessExpectedResult('{ "_class": "hudson.model.FreeStyleProject" }');
    }
    if (url.endsWith('//20/api/json?tree=artifacts[*]')) {
        return helper.GetSuccessExpectedResult('{ "artifacts": [ { "relativePath": "drop/x" } ] }');
    }
    if (url.indexOf('changeSet[') !== -1) {
        return helper.GetSuccessExpectedResult('{ "actions": [], "changeSet": { "kind": "git", "items": [ { "commitId": "abc", "author": { "fullName": "user" }, "msg": "test", "date": "2018-07-07 12:18:48 +0530" } ] } }');
    }
    if (url.indexOf('tree=actions[issues') !== -1) {
        return helper.GetSuccessExpectedResult('{ "actions": [] }');
    }
});

tr.run();
