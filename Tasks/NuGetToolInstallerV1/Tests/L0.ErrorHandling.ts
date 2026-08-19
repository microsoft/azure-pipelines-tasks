import * as assert from 'assert';
import { TestHelpers } from './TestHelpers';
import { TestDataBuilder, TestData } from './TestConstants';

describe('NuGetToolInstallerV1 L0 Suite - Error Handling', function () {
    this.timeout(30000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Tool Download Failures', function () {
        it('fails when getNuGet throws an error', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forGetNuGetFailure('Unable to download NuGet version 5.11.0')
            );

            TestHelpers.assertFailure(tr);
            TestHelpers.assertStdoutContains(tr, `Mock: getNuGet called with versionSpec=${TestData.explicitVersionSpec}, checkLatest=false`);
        });

        it('fails with default error message when getNuGet fails', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forGetNuGetFailure()
            );

            TestHelpers.assertFailure(tr);
        });
    });

    describe('Telemetry Resilience', function () {
        it('still emits telemetry even when task fails', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forGetNuGetFailure()
            );

            TestHelpers.assertFailure(tr);
            TestHelpers.assertTelemetryEmitted(tr);
            TestHelpers.assertStdoutContains(tr, `${TestData.telemetryArea}.${TestData.telemetryFeature}`);
        });

        it('handles telemetry errors gracefully without affecting task result', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forTelemetryError()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertStdoutDoesNotContain(tr, 'Telemetry emitted:');
        });
    });

    describe('PE Parser Edge Cases', function () {
        it('handles null fileVersion from PE parser gracefully', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forNullVersionInfo()
            );

            // Task should succeed; nugetVersion is omitted from telemetry when fileVersion is null
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertTelemetryEmitted(tr);
            TestHelpers.assertStdoutContains(tr, `Mock: getNuGet called with versionSpec=${TestData.explicitVersionSpec}, checkLatest=false`);
            assert(tr.stdout.indexOf('"nugetVersion":"') < 0,
                'nugetVersion should not have a string value in telemetry when fileVersion is null');
        });
    });
});
