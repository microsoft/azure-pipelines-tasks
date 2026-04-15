import { TestHelpers } from './TestHelpers';
import { TestDataBuilder, TestData } from './TestConstants';

describe('NuGetToolInstallerV1 L0 Suite - Tool Installation', function () {
    this.timeout(30000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Behavior validation', function () {
        it('uses explicit versionSpec and resolves MSBuild version string', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forExplicitVersion(TestData.explicitVersionSpec)
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertStdoutContains(tr, `Mock: getNuGet called with versionSpec=${TestData.explicitVersionSpec}, checkLatest=false`);
            TestHelpers.assertStdoutContains(tr, 'Mock: getMSBuildVersionString called');
            TestHelpers.assertTelemetryEmitted(tr);
        });

        it('uses default >=4.9 when no versionSpec is provided', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forDefaultVersion()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertStdoutContains(tr, `Mock: getNuGet called with versionSpec=${TestData.defaultVersionSpec}, checkLatest=false`);
            TestHelpers.assertStdoutContains(tr, 'Mock: getMSBuildVersionString called');
            TestHelpers.assertTelemetryEmitted(tr);
        });

        it('forwards checkLatest=true to getNuGet', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forCheckLatest()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertStdoutContains(tr, `Mock: getNuGet called with versionSpec=${TestData.explicitVersionSpec}, checkLatest=true`);
        });
    });
});
