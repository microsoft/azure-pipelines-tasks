import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('DownloadBuildArtifactsV2 Suite', function () {
    it('No build type provided should fail', async () => {
        const tp: string = path.join(__dirname, 'L0NoBuildTypeProvidedFail.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.stdOutContained('Input required: buildType'));
        assert(tr.failed, 'task should have failed');
    }).timeout(10000);

    it('No download path provided should fail', async () => {
        const tp: string = path.join(__dirname, 'L0NoDownloadPathProvidedFail.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.stdOutContained('Input required: downloadPath'));
        assert(tr.failed, 'task should have failed');
    }).timeout(10000);

    it('No download type provided should fail', async () => {
        const tp: string = path.join(__dirname, 'L0NoDownloadTypeProvidedFail.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.stdOutContained('Input required: downloadType'));
        assert(tr.failed, 'task should have failed');
    }).timeout(10000);

    it('Tar extraction on Windows should fail fast', async function () {
        if (process.platform !== 'win32') {
            this.skip();
        }
        const tp: string = path.join(__dirname, 'L0TarExtractionOnWindowsFail.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained('loc_mock_TarExtractionNotSupportedInWindows'));
    }).timeout(10000);

    it('An unknown project should fail with the message of the agent plugin', async () => {
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, 'L0UnknownProjectFail.js'));
        await tr.runAsync();
        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained('Get project failed missing-project , exception: HTTP 404'), tr.stdout);
    }).timeout(10000);

    it('The project id of the current run must be a GUID, like Guid.Parse in the agent plugin', async () => {
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, 'L0InvalidProjectIdFail.js'));
        await tr.runAsync();
        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained("The project id 'not-a-guid' is not a valid GUID"), tr.stdout);
    }).timeout(10000);

    it('Reads boolean inputs like bool.TryParse: white space of .NET around the word is allowed', async () => {
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, 'L0BooleanInputsLikeDotNet.js'));
        await tr.runAsync();
        assert(tr.succeeded, `task should have succeeded\n${tr.stdout}`);
        assert.strictEqual(downloadRequest(tr).params.checkDownloadedFiles, true);
    }).timeout(10000);

    it('The project of the triggering build replaces the project for the build query', async () => {
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, 'L0TriggeringProject.js'));
        await tr.runAsync();
        assert(tr.succeeded, `task should have succeeded\n${tr.stdout}`);
        assert(tr.stdOutContained('BUILDS project=bbbbbbbb-1111-1111-1111-111111111111'), tr.stdout);
        const request = downloadRequest(tr);
        assert.strictEqual(request.params.project, 'my-project');
        assert.strictEqual(request.params.pipelineId, 7);
    }).timeout(10000);

    it('Downloads all artifacts unless the download type is single, and reads the limits like int.TryParse', async () => {
        const all: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, 'L0DownloadAll.js'));
        await all.runAsync();
        assert(all.succeeded, `task should have succeeded\n${all.stdout}`);
        const allRequest = downloadRequest(all);
        assert.strictEqual(allRequest.downloadAll, true);
        assert.strictEqual(allRequest.params.parallelizationLimit, 0);
        assert.strictEqual(allRequest.params.retryDownloadCount, 4);

        const single: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, 'L0DownloadSingle.js'));
        await single.runAsync();
        assert(single.succeeded, `task should have succeeded\n${single.stdout}`);
        const singleRequest = downloadRequest(single);
        assert.strictEqual(singleRequest.downloadAll, false);
        assert.strictEqual(singleRequest.params.artifactName, 'drop');
        assert.strictEqual(singleRequest.params.parallelizationLimit, 3);
        assert.strictEqual(singleRequest.params.retryDownloadCount, 2);
    }).timeout(20000);
});

function downloadRequest(runner: ttm.MockTestRunner): any {
    const line = runner.stdout.split(/\r?\n/).find(text => text.startsWith('DOWNLOAD '));
    assert(line, `the shared library should have been asked to download\n${runner.stdout}`);
    return JSON.parse(line!.substring('DOWNLOAD '.length));
}
