import { TestHelpers } from './TestHelpers';
import { TestDataBuilder, TestData, TestEnvVars } from './TestConstants';

describe('NuGetToolInstallerV1 L0 Suite - Tool Installation', function () {
    this.timeout(30000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Explicit Version Spec', function () {
        it('installs NuGet with explicit version spec', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forExplicitVersion(TestData.explicitVersionSpec)
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertStdoutContains(tr, `getNuGet called with versionSpec=${TestData.explicitVersionSpec}`);
        });

        it('uses default >=4.9 when no version spec is provided', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forDefaultVersion()
            );

            TestHelpers.assertSuccess(tr);
            // V1 falls back to DEFAULT_NUGET_VERSION '>=4.9' instead of calling resolveNuGetVersion
            TestHelpers.assertStdoutContains(tr, 'getNuGet called with versionSpec=>=4.9');
        });
    });

    describe('Check Latest', function () {
        it('passes checkLatest=true to getNuGet', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forCheckLatest()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertStdoutContains(tr, 'checkLatest=true');
        });

        it('passes checkLatest=false to getNuGet when disabled', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertStdoutContains(tr, 'checkLatest=false');
        });
    });

    describe('MSBuild Version Resolution', function () {
        it('always calls getMSBuildVersionString regardless of version spec', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forExplicitVersion(TestData.explicitVersionSpec)
            );

            TestHelpers.assertSuccess(tr);
            // V1 always calls getMSBuildVersionString, unlike V0 which only calls it when no versionSpec
            TestHelpers.assertStdoutContains(tr, 'getMSBuildVersionString called');
        });

        it('calls getMSBuildVersionString when using default version', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forDefaultVersion()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertStdoutContains(tr, 'getMSBuildVersionString called');
        });
    });
});
