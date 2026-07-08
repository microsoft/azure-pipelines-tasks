import { TestHelpers } from './TestHelpers';
import { TestDataBuilder, TestData, TestEnvVars } from './TestConstants';

describe('NuGetToolInstallerV0 L0 Suite - Telemetry', function () {
    this.timeout(30000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Telemetry Emission', function () {
        it('includes checkLatest=true and explicit request in telemetry', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forCheckLatest()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertTelemetryEmitted(tr);
            TestHelpers.assertStdoutContains(tr, `Mock: getNuGet called with versionSpec=${TestData.defaultVersionSpec}, checkLatest=true`);
            TestHelpers.assertStdoutContains(tr, '"isCheckLatestEnabled":true');
            TestHelpers.assertStdoutContains(tr, `"requestedNuGetVersionSpec":"${TestData.defaultVersionSpec}"`);
        });

        it('includes resolved version path and msbuild data when no versionSpec is provided', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forDefaultVersion({
                    [TestEnvVars.msBuildVersion]: '16.11.0'
                })
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertTelemetryEmitted(tr);
            TestHelpers.assertStdoutContains(tr, `Mock: resolveNuGetVersion called, returning ${TestData.resolvedVersionSpec}`);
            TestHelpers.assertStdoutContains(tr, `Mock: getNuGet called with versionSpec=${TestData.resolvedVersionSpec}, checkLatest=false`);
            TestHelpers.assertStdoutContains(tr, `"nuGetPath":"${TestData.defaultNuGetPath.replace(/\\/g, '\\\\')}"`);
            TestHelpers.assertStdoutContains(tr, `"nugetVersion":"${TestData.defaultNuGetVersionInfo.join('.')}"`);
            TestHelpers.assertStdoutContains(tr, '"msBuildVersion":"16.11.0"');
        });

        it('omits msBuildVersion from telemetry when not resolved', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forExplicitVersion(TestData.defaultVersionSpec)
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertTelemetryEmitted(tr);
            // msBuildVersion is undefined when explicit version spec is used,
            // and JSON.stringify omits undefined properties
            TestHelpers.assertStdoutDoesNotContain(tr, '"msBuildVersion":"16');
        });
    });
});
