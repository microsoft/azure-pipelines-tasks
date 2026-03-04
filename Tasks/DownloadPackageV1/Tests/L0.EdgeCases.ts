import { TestHelpers } from './TestHelpers';
import { TestDataBuilder, TestEnvVars } from './TestConstants';

describe('DownloadPackageV1 L0 Suite - Universal & Cargo Downloads', function () {
    this.timeout(30000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Universal Package (upack) Download', function () {
        it('routes upack to downloadUniversalPackage', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forUniversalDownload()
            );

            // Universal packages use the artifact tool path, not the standard download
            TestHelpers.assertStdoutContains(tr, 'Universal package download called');
        });

        it('routes upack with project-scoped feed', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forUniversalDownload({
                    [TestEnvVars.feed]: 'projectId/feedId'
                })
            );

            TestHelpers.assertStdoutContains(tr, 'Universal package download called');
        });
    });

    describe('Extract Flag Edge Cases', function () {
        it('ignores extract flag for maven packages', async () => {
            // Maven uses multi-file download, extract is not applicable
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forMavenDownload({
                    [TestEnvVars.extract]: 'true'
                })
            );

            TestHelpers.assertSuccess(tr);
            // Maven files should be downloaded directly, not extracted
            TestHelpers.assertFileInDestination('packageName.jar');
            TestHelpers.assertFileInDestination('packageName.pom');
        });

        it('does not extract npm when extract is false', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forNpmDownload({
                    [TestEnvVars.extract]: 'false'
                })
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertFileCount(TestHelpers.tempDir, 0);
            TestHelpers.assertFileInDestination('singlePackageName.tgz');
        });
    });

    describe('View Handling', function () {
        it('appends view ID to feed when view is non-empty', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forNuGetDownload({
                    [TestEnvVars.view]: 'releaseView'
                })
            );

            TestHelpers.assertSuccess(tr);
        });

        it('does not append view when view is whitespace-only', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forNuGetDownload({
                    [TestEnvVars.view]: '   '
                })
            );

            TestHelpers.assertSuccess(tr);
        });
    });
});
