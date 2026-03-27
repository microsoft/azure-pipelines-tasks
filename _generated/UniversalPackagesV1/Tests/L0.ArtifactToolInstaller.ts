import * as path from 'path';
import * as assert from 'assert';
import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';
import { TEST_CONSTANTS } from './testConstants';

async function runPreJobTest(envVars: { [key: string]: string }): Promise<MockTestRunner> {
    const envKeys = Object.keys(envVars);
    for (const key of envKeys) {
        process.env[key] = envVars[key];
    }

    try {
        const tp = path.join(__dirname, 'PreJobTestSetup.js');
        const tr = new MockTestRunner(tp);
        await tr.runAsync(20);
        return tr;
    } finally {
        for (const key of envKeys) {
            delete process.env[key];
        }
        delete process.env['UPACK_ARTIFACTTOOL_PATH_CACHED'];
        delete process.env['VSTS_TASKVARIABLE_UPACK_ARTIFACTTOOL_PATH'];
    }
}

describe('UniversalPackagesV1 - Artifact Tool Installer (Pre-Job)', function () {
    this.timeout(10000);

    describe('Successful Installation', function () {
        it('installs artifact tool successfully', async () => {
            const tr = await runPreJobTest({});

            assert(tr.succeeded, 'Task should have succeeded');
            assert.strictEqual(tr.errorIssues.length, 0, 'Should have no errors');
        });

        it('sets UPACK_ARTIFACTTOOL_PATH task variable on success', async () => {
            const tr = await runPreJobTest({});

            assert(tr.succeeded, 'Task should have succeeded');
            assert(tr.stdOutContained('UPACK_ARTIFACTTOOL_PATH'), 'Should set UPACK_ARTIFACTTOOL_PATH task variable');
        });

        it('caches artifact tool path in pipeline variable', async () => {
            const tr = await runPreJobTest({});

            assert(tr.succeeded, 'Task should have succeeded');
            assert(tr.stdOutContained('UPACK_ARTIFACTTOOL_PATH_CACHED'), 'Should cache path in pipeline variable');
        });

        it('skips installation if artifact tool is already cached', async () => {
            const tr = await runPreJobTest({
                'MOCK_CACHED_ARTIFACT_TOOL_PATH': TEST_CONSTANTS.ARTIFACT_TOOL_PATH,
            });

            assert(tr.succeeded, 'Task should have succeeded');
            assert(tr.stdOutContained('loc_mock_Info_ArtifactToolPathResolvedFromCache'), 'Should use cached path');
        });

        it('emits telemetry on success', async () => {
            const tr = await runPreJobTest({});

            assert(tr.succeeded, 'Task should have succeeded');
            assert(tr.stdOutContained('Telemetry emitted: Packaging.UniversalPackagesV1'), 'Should emit telemetry');
        });
    });

    describe('Installation Errors', function () {
        it('fails when running on-premises', async () => {
            const tr = await runPreJobTest({
                'MOCK_SERVER_TYPE': 'OnPremises',
            });

            assert(tr.failed, 'Task should have failed');
            assert(tr.stdOutContained('loc_mock_Error_FailedToGetArtifactTool'), 'Should report artifact tool failure');
        });

        it('fails when artifact tool installation fails', async () => {
            const tr = await runPreJobTest({
                'MOCK_SHOULD_FAIL_INSTALL': 'true',
            });

            assert(tr.failed, 'Task should have failed');
            assert(tr.stdOutContained('loc_mock_Error_FailedToGetArtifactTool'), 'Should report artifact tool failure');
        });

        it('still emits telemetry when installation fails', async () => {
            const tr = await runPreJobTest({
                'MOCK_SHOULD_FAIL_INSTALL': 'true',
            });

            assert(tr.failed, 'Task should have failed');
            assert(tr.stdOutContained('Telemetry emitted: Packaging.UniversalPackagesV1'), 'Should emit telemetry even on failure');
        });
    });
});
