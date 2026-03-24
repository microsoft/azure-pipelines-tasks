import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('UniversalPackages L0 Suite - Artifact Tool Installer', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Artifact Tool Installation', function () {
        it('installs artifact tool successfully', async () => {
            const tr = await TestHelpers.runPreJobTest({
                [testConstants.TestEnvVars.serverType]: 'hosted',
            });

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertStdoutContains(tr, 'loc_mock_Info_ArtifactToolPath');
        });

        it('sets UPACK_ARTIFACTTOOL_PATH task variable on success', async () => {
            const tr = await TestHelpers.runPreJobTest({
                [testConstants.TestEnvVars.serverType]: 'hosted',
            });

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertStdoutContains(tr, 'UPACK_ARTIFACTTOOL_PATH');
        });

        it('caches artifact tool path in pipeline variable', async () => {
            const tr = await TestHelpers.runPreJobTest({
                [testConstants.TestEnvVars.serverType]: 'hosted',
            });

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertStdoutContains(tr, 'UPACK_ARTIFACTTOOL_PATH_CACHED');
        });

        it('skips installation if artifact tool is already cached', async () => {
            const tr = await TestHelpers.runPreJobTest({
                [testConstants.TestEnvVars.serverType]: 'hosted',
                [testConstants.TestEnvVars.cachedArtifactToolPath]: testConstants.TestData.defaultArtifactToolPath,
            });

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertStdoutContains(tr, 'Artifact tool path resolved from cached pipeline variable');
        });

        it('emits telemetry on success', async () => {
            const tr = await TestHelpers.runPreJobTest({
                [testConstants.TestEnvVars.serverType]: 'hosted',
            });

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertStdoutContains(tr, 'Telemetry emitted: Packaging.UniversalPackages');
        });
    });

    describe('Artifact Tool Installation Errors', function () {
        it('fails when running on-premises', async () => {
            const tr = await TestHelpers.runPreJobTest({
                [testConstants.TestEnvVars.serverType]: 'OnPremises',
            });

            TestHelpers.assertFailure(tr);
            TestHelpers.assertStdoutContains(tr, 'loc_mock_FailedToGetArtifactTool');
            TestHelpers.assertStdoutContains(tr, 'loc_mock_Error_UniversalPackagesNotSupportedOnPrem');
        });

        it('fails when artifact tool installation fails', async () => {
            const tr = await TestHelpers.runPreJobTest({
                [testConstants.TestEnvVars.serverType]: 'hosted',
                [testConstants.TestEnvVars.shouldFailInstall]: 'true',
            });

            TestHelpers.assertFailure(tr);
            TestHelpers.assertStdoutContains(tr, 'loc_mock_FailedToGetArtifactTool');
        });

        it('still emits telemetry when installation fails', async () => {
            const tr = await TestHelpers.runPreJobTest({
                [testConstants.TestEnvVars.serverType]: 'hosted',
                [testConstants.TestEnvVars.shouldFailInstall]: 'true',
            });

            TestHelpers.assertFailure(tr);
            // Telemetry should still fire from the finally block
            TestHelpers.assertStdoutContains(tr, 'Telemetry emitted: Packaging.UniversalPackages');
        });
    });
});
