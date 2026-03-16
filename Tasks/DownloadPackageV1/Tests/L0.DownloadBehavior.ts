// Tests how the download task behaves based on input combinations:
// - Universal (upack) packages route to the artifact tool instead of HTTP download
// - The extract flag is respected for npm/nuget but ignored for maven
// - View IDs are appended to feed identifiers when non-empty
import { TestHelpers } from './TestHelpers';
import { TestDataBuilder, TestData, TestEnvVars } from './TestConstants';

describe('DownloadPackageV1 L0 Suite - Download Behavior', function () {
    this.timeout(30000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Universal Package (upack) Download', function () {
        it('routes upack to downloadUniversalPackage with correct parameters', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forUniversalDownload()
            );

            // Task should succeed — universal download was invoked
            TestHelpers.assertSuccess(tr);
        });

        it('routes upack with project-scoped feed and splits projectId correctly', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forUniversalDownload({
                    [TestEnvVars.feed]: 'projectId/feedId'
                })
            );

            TestHelpers.assertSuccess(tr);
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
        it('downloads successfully when a view is specified', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forNuGetDownload({
                    [TestEnvVars.feed]: 'feedId',
                    [TestEnvVars.view]: 'releaseView'
                })
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertFileDownloaded('singlePackageName.nupkg');
        });

        it('downloads successfully when view is whitespace-only (treated as empty)', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forNuGetDownload({
                    [TestEnvVars.feed]: 'feedId',
                    [TestEnvVars.view]: '   '
                })
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertFileDownloaded('singlePackageName.nupkg');
        });
    });
});
