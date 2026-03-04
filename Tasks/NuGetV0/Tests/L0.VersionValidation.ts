import { TestHelpers } from './TestHelpers';
import { TestDataBuilder, TestData, TestEnvVars } from './TestConstants';

describe('NuGetV0 L0 Suite - Version Validation', function () {
    this.timeout(30000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Minimum Version Enforcement', function () {
        it('fails when NuGet version is below 3.5.0', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forOldVersion()
            );

            TestHelpers.assertFailure(tr, 'Info_NuGetSupportedAfter3_5');
        });

        it('succeeds with NuGet version exactly 3.5.0', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults({
                    [TestEnvVars.nuGetVersion]: '3.5.0',
                    [TestEnvVars.nuGetVersionInfo]: JSON.stringify([3, 5, 0, 0])
                })
            );

            TestHelpers.assertSuccess(tr);
        });

        it('succeeds with NuGet version above 3.5.0', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults({
                    [TestEnvVars.nuGetVersion]: TestData.newVersion,
                    [TestEnvVars.nuGetVersionInfo]: JSON.stringify(TestData.newVersionInfo)
                })
            );

            TestHelpers.assertSuccess(tr);
        });

        it('fails when major version is below 3', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults({
                    [TestEnvVars.nuGetVersion]: '2.9.0',
                    [TestEnvVars.nuGetVersionInfo]: JSON.stringify([2, 9, 0, 0])
                })
            );

            TestHelpers.assertFailure(tr, 'Info_NuGetSupportedAfter3_5');
        });

        it('fails when version is 3.4.x (just under threshold)', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults({
                    [TestEnvVars.nuGetVersion]: '3.4.4',
                    [TestEnvVars.nuGetVersionInfo]: JSON.stringify([3, 4, 4, 0])
                })
            );

            TestHelpers.assertFailure(tr, 'Info_NuGetSupportedAfter3_5');
        });

        it('fails when version is 3.0.0', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults({
                    [TestEnvVars.nuGetVersion]: '3.0.0',
                    [TestEnvVars.nuGetVersionInfo]: JSON.stringify([3, 0, 0, 0])
                })
            );

            TestHelpers.assertFailure(tr, 'Info_NuGetSupportedAfter3_5');
        });

        it('succeeds with NuGet version 4.0.0', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults({
                    [TestEnvVars.nuGetVersion]: '4.0.0',
                    [TestEnvVars.nuGetVersionInfo]: JSON.stringify([4, 0, 0, 0])
                })
            );

            TestHelpers.assertSuccess(tr);
        });
    });
});
