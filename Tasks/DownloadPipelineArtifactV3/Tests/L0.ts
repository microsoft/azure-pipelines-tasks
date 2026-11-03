import assert = require('assert');
import fs = require('fs');
import os = require('os');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('DownloadPipelineArtifactV3 Suite', function () {
    it('fails on-premises', async () => {
        const tp: string = path.join(__dirname, 'L0OnPremNotSupported.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained('loc_mock_OnPremIsNotSupported'));
    }).timeout(30000);

    it('fails for an invalid artifact name', async () => {
        const tp: string = path.join(__dirname, 'L0InvalidArtifactName.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained('loc_mock_ArtifactNameIsNotValid bad/name'));
    }).timeout(30000);

    it('fails when the project is missing for a specific run', async () => {
        const tp: string = path.join(__dirname, 'L0MissingProjectForSpecific.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained('loc_mock_CannotBeNullOrEmpty Project Name'));
    }).timeout(30000);

    it('fails when the run id is invalid', async () => {
        const tp: string = path.join(__dirname, 'L0InvalidRunId.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained('loc_mock_RunIDNotValid abc'));
    }).timeout(30000);

    it('fails in release current-run jobs without a build id', async () => {
        const tp: string = path.join(__dirname, 'L0ReleaseCurrentRunNoBuildId.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained('loc_mock_BuildIdIsNotAvailable Release Release'));
    }).timeout(30000);

    it('fails when the project id of the current run is not a GUID, like Guid.Parse in the agent plugin', async () => {
        const tp: string = path.join(__dirname, 'L0InvalidProjectId.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained("The project id 'not-a-guid' is not a valid GUID"), tr.stdout);
    }).timeout(30000);

    it('creates the HTTP client before the artifact providers when it downloads from the current run', async () => {
        const tp: string = path.join(__dirname, 'L0CurrentRun.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        assert(tr.succeeded, `task should have succeeded\n${tr.stdout}`);
        assert(tr.stdOutContained('"pipelineId":42'), tr.stdout);
        fs.rmSync(path.join(os.tmpdir(), 'dpa-l0-current-run'), { recursive: true, force: true });
    }).timeout(30000);
});
