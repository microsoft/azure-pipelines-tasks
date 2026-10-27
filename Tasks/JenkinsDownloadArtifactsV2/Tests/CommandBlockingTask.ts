import path = require('path');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import helper = require('./JenkinsTestHelper');

const tr = new tmrm.TaskMockRunner(path.join(__dirname, '..', 'jenkinsdownloadartifacts.js'));
tr.setInput('serverEndpoint', 'ID1');
tr.setInput('jobName', 'example');
tr.setInput('saveTo', path.join(__dirname, 'mock-artifacts'));
tr.setInput('jenkinsBuild', 'BuildNumber');
tr.setInput('jenkinsBuildNumber', '42');
tr.setInput('itemPattern', process.env['JENKINS_TEST_PATTERN']);
tr.setInput('downloadCommitsAndWorkItems', 'false');
process.env['RELEASE_ARTIFACT_DOWNLOAD_PARALLELLIMIT'] = process.env['JENKINS_TEST_PARALLEL'];
process.env['SYSTEM_DEBUG'] = process.env['JENKINS_TEST_DEBUG'];

process.env['ENDPOINT_URL_ID1'] = 'http://jenkins.invalid';
process.env['ENDPOINT_AUTH_PARAMETER_ID1_USERNAME'] = 'username';
process.env['ENDPOINT_AUTH_PARAMETER_ID1_PASSWORD'] = 'password';
process.env['ENDPOINT_DATA_ID1_acceptUntrustedCerts'] = 'false';

helper.RegisterArtifactEngineMock(tr, (options, source) => {
    console.log('JENKINS_DOWNLOADER_OPTIONS=' + JSON.stringify({ provider: source.constructor.name, options }));
});
helper.RegisterHttpClientMock(tr, (url: string) => helper.GetSuccessExpectedResult(
    url.indexOf('tree=artifacts') !== -1
        ? '{"artifacts":[{"relativePath":"drop/result.txt"}]}'
        : '{"_class":"hudson.model.FreeStyleProject"}'));

// The ZIP entry path should exercise option construction, not extraction or disk I/O.
tr.registerMock('extract-zip', () => Promise.resolve());
tr.registerMock('decompress-zip', function () {
    const callbacks: { [event: string]: () => void } = {};
    return {
        on: (event: string, callback: () => void) => { callbacks[event] = callback; },
        extract: () => callbacks['extract']()
    };
});
tr.registerMock('fs-extra', {
    move: () => Promise.resolve(),
    copy: () => Promise.resolve(),
    remove: () => Promise.resolve()
});
tr.registerMockExport('exist', () => false);
tr.run();
