import * as assert from 'assert';
import { TestHelpers } from './TestHelpers';
import { TestDataBuilder, TestEnvVars } from './TestConstants';

describe('DownloadPackageV1 L0 Suite - Input Validation & Edge Cases', function () {
    this.timeout(30000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Skip Download', function () {
        it('skips download when Packaging.SkipDownload is true', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forSkipDownload()
            );

            // Task returns early without failing — no files downloaded
            assert(!tr.failed, 'Task should not fail when skip is enabled');
            assert.strictEqual(tr.errorIssues.length, 0, 'Should have no error issues');
            TestHelpers.assertFileCount(TestHelpers.tempDir, 0);
            TestHelpers.assertFileCount(TestHelpers.destinationDir, 0);
        });
    });

    describe('Feed Scoping', function () {
        it('downloads successfully with org-scoped feed', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forNuGetDownload({
                    [TestEnvVars.feed]: 'feedId'
                })
            );

            TestHelpers.assertSuccess(tr);
            // Verify the download actually completed by checking file output
            TestHelpers.assertFileDownloaded('singlePackageName.nupkg');
            TestHelpers.assertFileExtracted('nugetFile');
        });

        it('downloads successfully with project-scoped feed', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forProjectScopedFeed()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertFileDownloaded('singlePackageName.nupkg');
            TestHelpers.assertFileExtracted('nugetFile');
        });
    });

    describe('Package Name Resolution', function () {
        it('resolves package name to ID and downloads successfully', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forNameResolution()
            );

            TestHelpers.assertSuccess(tr);
            // Prove the resolution worked: file was downloaded using the resolved ID
            TestHelpers.assertFileDownloaded('singlePackageName.nupkg');
            TestHelpers.assertFileExtracted('nugetFile');
        });

        it('skips name resolution when definition is already a GUID', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forNuGetDownload()
            );

            TestHelpers.assertSuccess(tr);
            // File still downloads — GUID was used directly
            TestHelpers.assertFileDownloaded('singlePackageName.nupkg');
            TestHelpers.assertFileExtracted('nugetFile');
        });
    });
});
