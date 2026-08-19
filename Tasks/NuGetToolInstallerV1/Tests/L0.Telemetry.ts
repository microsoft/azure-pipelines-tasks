import { TestHelpers } from './TestHelpers';
import { TestDataBuilder, TestData, TestEnvVars } from './TestConstants';

describe('NuGetToolInstallerV1 L0 Suite - Telemetry', function () {
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
            TestHelpers.assertStdoutContains(tr, `Mock: getNuGet called with versionSpec=${TestData.explicitVersionSpec}, checkLatest=true`);
            TestHelpers.assertStdoutContains(tr, '"isCheckLatestEnabled":true');
            TestHelpers.assertStdoutContains(tr, `"requestedNuGetVersionSpec":"${TestData.explicitVersionSpec}"`);
        });

        it('uses default version and includes DEFAULT_NUGET_VERSION telemetry field', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forDefaultVersion()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertTelemetryEmitted(tr);
            TestHelpers.assertStdoutContains(tr, `Mock: getNuGet called with versionSpec=${TestData.defaultVersionSpec}, checkLatest=false`);
            TestHelpers.assertStdoutContains(tr, `"nuGetPath":"${TestData.defaultNuGetPath.replace(/\\/g, '\\\\')}"`);
            TestHelpers.assertStdoutContains(tr, `"nugetVersion":"${TestData.defaultNuGetVersionInfo.join('.')}"`);
            TestHelpers.assertStdoutContains(tr, `"DEFAULT_NUGET_VERSION":"${TestData.defaultVersionSpec}"`);
        });

        it('includes MSBuild version in telemetry when resolved', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults({
                    [TestEnvVars.msBuildVersion]: '16.11.0'
                })
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertTelemetryEmitted(tr);
            TestHelpers.assertStdoutContains(tr, '"msBuildVersion":"16.11.0"');
        });

        it('sets checkLatest=false in telemetry when disabled', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertTelemetryEmitted(tr);
            TestHelpers.assertStdoutContains(tr, '"isCheckLatestEnabled":false');
        });
    });
});
