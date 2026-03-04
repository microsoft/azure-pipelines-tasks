import { TestHelpers } from './TestHelpers';
import { TestDataBuilder, TestData, TestEnvVars } from './TestConstants';

describe('NuGetV0 L0 Suite - Tool Resolution', function () {
    this.timeout(30000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('NuGet Path Resolution', function () {
        it('uses NuGet from environment variable when set', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forEnvPath()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNuGetRan(tr, TestData.envNuGetPath, 'testCommand', 'testArgument');
        });

        it('downloads NuGet when environment variable is not set', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNuGetRan(tr, TestData.defaultNuGetPath, 'testCommand', 'testArgument');
        });
    });

    describe('Credential Provider', function () {
        it('succeeds when credential provider is available', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults()
            );

            TestHelpers.assertSuccess(tr);
        });
    });

    describe('Extra URL Prefixes', function () {
        it('succeeds when NuGetTasks.ExtraUrlPrefixesForTesting is set', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forExtraUrlPrefixes('https://proxy1.example.com;https://proxy2.example.com')
            );

            TestHelpers.assertSuccess(tr);
        });

        it('does not add extra prefixes when variable is not set', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertStdoutDoesNotContain(tr, 'All URL prefixes:');
        });
    });
});
