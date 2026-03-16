import { TestHelpers } from './TestHelpers';
import { TestDataBuilder, TestData, TestEnvVars } from './TestConstants';

describe('NuGetToolInstallerV0 L0 Suite - Tool Installation', function () {
    this.timeout(30000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Explicit Version Spec', function () {
        it('installs NuGet with explicit version spec', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forExplicitVersion(TestData.explicitVersionSpec)
            );

            TestHelpers.assertSuccess(tr);
        });

        it('installs NuGet with default version when no spec provided', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forDefaultVersion()
            );

            TestHelpers.assertSuccess(tr);
        });
    });

    describe('Check Latest', function () {
        it('succeeds with checkLatest=true', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forCheckLatest()
            );

            TestHelpers.assertSuccess(tr);
        });

        it('succeeds with checkLatest=false', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults()
            );

            TestHelpers.assertSuccess(tr);
        });
    });

    describe('MSBuild Version Resolution', function () {
        it('succeeds when using default version (triggers MSBuild resolution)', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forDefaultVersion()
            );

            TestHelpers.assertSuccess(tr);
        });

        it('succeeds with explicit version spec (skips MSBuild resolution)', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forExplicitVersion(TestData.explicitVersionSpec)
            );

            TestHelpers.assertSuccess(tr);
        });
    });
});
