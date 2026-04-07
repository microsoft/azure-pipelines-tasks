import * as assert from 'assert';
import { runTestWithEnv } from './testHelpers';
import { TEST_CONSTANTS, getDefaultPreJobEnvVars } from './testConstants';

const PRE_JOB_ENV = { ...getDefaultPreJobEnvVars(), 'MOCK_PRE_JOB': 'true' };

describe('UniversalPackagesV1 - Artifact Tool Installer (Pre-Job)', function () {
    this.timeout(10000);

    describe('Successful Installation', function () {
        it('installs artifact tool successfully', async () => {
            const tr = await runTestWithEnv('./testRunner.js', {
                ...PRE_JOB_ENV,
            });

            assert(tr.succeeded, 'Task should have succeeded');
            assert.strictEqual(tr.errorIssues.length, 0, 'Should have no errors');
        });

        it('sets UPACK_ARTIFACTTOOL_PATH task variable on success', async () => {
            const tr = await runTestWithEnv('./testRunner.js', {
                ...PRE_JOB_ENV,
            });

            assert(tr.succeeded, 'Task should have succeeded');
            assert(tr.stdOutContained('UPACK_ARTIFACTTOOL_PATH'), 'Should set UPACK_ARTIFACTTOOL_PATH task variable');
        });

        it('caches artifact tool path in pipeline variable', async () => {
            const tr = await runTestWithEnv('./testRunner.js', {
                ...PRE_JOB_ENV,
            });

            assert(tr.succeeded, 'Task should have succeeded');
            assert(tr.stdOutContained('UPACK_ARTIFACTTOOL_PATH_CACHED'), 'Should cache path in pipeline variable');
        });

        it('skips installation if artifact tool is already cached', async () => {
            const tr = await runTestWithEnv('./testRunner.js', {
                ...PRE_JOB_ENV,
                'UPACK_ARTIFACTTOOL_PATH_CACHED': TEST_CONSTANTS.ARTIFACT_TOOL_PATH,
            });

            assert(tr.succeeded, 'Task should have succeeded');
            assert(tr.stdOutContained('loc_mock_Info_ArtifactToolPathResolvedFromCache'), 'Should use cached path');
        });
    });

    describe('Installation Errors', function () {
        it('fails when running on-premises', async () => {
            const tr = await runTestWithEnv('./testRunner.js', {
                ...PRE_JOB_ENV,
                'SYSTEM_SERVERTYPE': 'OnPremises',
            });

            assert(tr.failed, 'Task should have failed');
            assert(tr.stdOutContained('Error_UniversalPackagesNotSupportedOnPrem'), 'Should report on-prem not supported');
        });

        it('fails when server type is undefined', async () => {
            const envVars = { ...PRE_JOB_ENV };
            delete envVars['SYSTEM_SERVERTYPE'];
            const tr = await runTestWithEnv('./testRunner.js', envVars);

            assert(tr.failed, 'Task should have failed');
            assert(tr.stdOutContained('Error_UniversalPackagesNotSupportedOnPrem'), 'Should report on-prem not supported');
        });

        it('fails when artifact tool installation fails', async () => {
            const tr = await runTestWithEnv('./testRunner.js', {
                ...PRE_JOB_ENV,
                'MOCK_SHOULD_FAIL_INSTALL': 'true',
            });

            assert(tr.failed, 'Task should have failed');
            assert(tr.stdOutContained('loc_mock_Error_FailedToGetArtifactTool'), 'Should report artifact tool failure');
        });

        it('fails when blob store URI resolution fails', async () => {
            const tr = await runTestWithEnv('./testRunner.js', {
                ...PRE_JOB_ENV,
                'MOCK_SHOULD_FAIL_BLOB_URI': 'true',
            });

            assert(tr.failed, 'Task should have failed');
            assert(tr.stdOutContained('loc_mock_Error_FailedToGetArtifactTool'), 'Should report artifact tool failure');
        });
    });
});
