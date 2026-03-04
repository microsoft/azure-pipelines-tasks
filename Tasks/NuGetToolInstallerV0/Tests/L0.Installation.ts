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
            TestHelpers.assertStdoutContains(tr, `getNuGet called with versionSpec=${TestData.explicitVersionSpec}`);
        });

        it('installs NuGet with default version when no spec provided', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forDefaultVersion()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertStdoutContains(tr, 'resolveNuGetVersion called');
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
        it('resolves MSBuild version when no version spec provided', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forDefaultVersion()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertStdoutContains(tr, 'getMSBuildVersion called');
        });

        it('does not resolve MSBuild version when explicit spec provided', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forExplicitVersion(TestData.explicitVersionSpec)
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertStdoutDoesNotContain(tr, 'getMSBuildVersion called');
        });
    });
});
