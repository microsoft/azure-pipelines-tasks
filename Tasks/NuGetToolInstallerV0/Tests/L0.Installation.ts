import { TestHelpers } from './TestHelpers';
import { TestDataBuilder, TestData } from './TestConstants';

describe('NuGetToolInstallerV0 L0 Suite - Tool Installation', function () {
    this.timeout(30000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Behavior validation', function () {
        it('uses explicit versionSpec directly and skips resolution helpers', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forExplicitVersion(TestData.explicitVersionSpec)
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertStdoutContains(tr, `Mock: getNuGet called with versionSpec=${TestData.explicitVersionSpec}, checkLatest=false`);
            TestHelpers.assertStdoutDoesNotContain(tr, 'Mock: resolveNuGetVersion called');
            TestHelpers.assertStdoutDoesNotContain(tr, 'Mock: getMSBuildVersion called');
            TestHelpers.assertTelemetryEmitted(tr);
        });

        it('resolves version and MSBuild when versionSpec is not provided', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forDefaultVersion()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertStdoutContains(tr, `Mock: resolveNuGetVersion called, returning ${TestData.resolvedVersionSpec}`);
            TestHelpers.assertStdoutContains(tr, `Mock: getNuGet called with versionSpec=${TestData.resolvedVersionSpec}, checkLatest=false`);
            TestHelpers.assertStdoutContains(tr, 'Mock: getMSBuildVersion called');
            TestHelpers.assertTelemetryEmitted(tr);
        });

        it('forwards checkLatest=true to getNuGet', async () => {
            const tr = await TestHelpers.runTest(TestDataBuilder.forCheckLatest());

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertStdoutContains(tr, `Mock: getNuGet called with versionSpec=${TestData.defaultVersionSpec}, checkLatest=true`);
        });
    });
});
