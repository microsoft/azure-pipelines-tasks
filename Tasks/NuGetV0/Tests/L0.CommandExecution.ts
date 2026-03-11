import { TestHelpers } from './TestHelpers';
import { TestDataBuilder, TestData, TestEnvVars } from './TestConstants';

describe('NuGetV0 L0 Suite - Command Execution', function () {
    this.timeout(30000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Basic Command Execution', function () {
        it('runs NuGet with command and arguments', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNuGetRan(tr, TestData.defaultNuGetPath, 'testCommand', 'testArgument');
            TestHelpers.assertStdoutContains(tr, TestData.defaultOutput);
        });

        it('runs NuGet without arguments when none provided', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forRestoreCommand()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNuGetRan(tr, TestData.defaultNuGetPath, 'restore');
        });
    });

    describe('Restore Command', function () {
        it('successfully runs restore with packages.config', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forRestoreCommand('packages.config -PackagesDirectory packages')
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNuGetRan(tr, TestData.defaultNuGetPath, 'restore', 'packages.config -PackagesDirectory packages');
        });

        it('successfully runs restore with solution file', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forRestoreCommand('myProject.sln')
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNuGetRan(tr, TestData.defaultNuGetPath, 'restore', 'myProject.sln');
        });
    });

    describe('Push Command', function () {
        it('successfully runs push with source and API key', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forPushCommand('mypackage.1.0.0.nupkg -Source https://api.nuget.org/v3/index.json -ApiKey myApiKey')
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNuGetRan(tr, TestData.defaultNuGetPath, 'push', 'mypackage.1.0.0.nupkg -Source https://api.nuget.org/v3/index.json -ApiKey myApiKey');
        });
    });

    describe('NonInteractive Flag', function () {
        it('always appends -NonInteractive flag', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forRestoreCommand('myProject.sln')
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNuGetRan(tr, TestData.defaultNuGetPath, 'restore', 'myProject.sln');
            TestHelpers.assertStdoutContains(tr, '-NonInteractive');
        });
    });

    describe('Other NuGet Commands', function () {
        it('runs pack command', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults({
                    [TestEnvVars.command]: 'pack',
                    [TestEnvVars.arguments]: 'myProject.nuspec -OutputDirectory nupkgs'
                })
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNuGetRan(tr, TestData.defaultNuGetPath, 'pack', 'myProject.nuspec -OutputDirectory nupkgs');
        });

        it('runs spec command with no arguments', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults({
                    [TestEnvVars.command]: 'spec',
                    [TestEnvVars.arguments]: ''
                })
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNuGetRan(tr, TestData.defaultNuGetPath, 'spec');
        });
    });
});
