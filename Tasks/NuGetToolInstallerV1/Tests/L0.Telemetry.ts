import { TestHelpers } from './TestHelpers';
import { TestDataBuilder, TestData, TestEnvVars } from './TestConstants';

describe('NuGetToolInstallerV1 L0 Suite - Telemetry', function () {
    this.timeout(30000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Telemetry Emission', function () {
        it('emits telemetry on successful installation', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertTelemetryEmitted(tr);
            TestHelpers.assertStdoutContains(tr, `${TestData.telemetryArea}.${TestData.telemetryFeature}`);
        });

        it('includes checkLatest value in telemetry', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forCheckLatest()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertTelemetryEmitted(tr);
            TestHelpers.assertStdoutContains(tr, '"isCheckLatestEnabled":true');
        });

        it('includes NuGet path and version in telemetry', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertTelemetryEmitted(tr);
            TestHelpers.assertStdoutContains(tr, `"nuGetPath":"${TestData.defaultNuGetPath.replace(/\\/g, '\\\\')}"`);
            TestHelpers.assertStdoutContains(tr, `"nugetVersion":"${TestData.defaultNuGetVersionInfo.join('.')}"`);
        });

        it('includes DEFAULT_NUGET_VERSION in telemetry', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertTelemetryEmitted(tr);
            TestHelpers.assertStdoutContains(tr, `"DEFAULT_NUGET_VERSION":"${TestData.defaultVersionSpec}"`);
        });

        it('includes requested version spec in telemetry', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forExplicitVersion(TestData.explicitVersionSpec)
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertTelemetryEmitted(tr);
            TestHelpers.assertStdoutContains(tr, `"requestedNuGetVersionSpec":"${TestData.explicitVersionSpec}"`);
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
