import { TestHelpers } from './TestHelpers';
import { TestDataBuilder } from './TestConstants';

describe('DownloadPackageV1 L0 Suite - NuGet Downloads', function () {
    this.timeout(30000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('NuGet Download with Extraction', function () {
        it('downloads nuget file as nupkg and extracts it', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forNuGetDownload()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertFileCount(TestHelpers.tempDir, 1);
            TestHelpers.assertFileDownloaded('singlePackageName.nupkg');
            TestHelpers.assertFileExtracted('nugetFile');
        });

        it('downloads nuget from project-scoped feed and extracts it', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forProjectScopedFeed()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertFileCount(TestHelpers.tempDir, 1);
            TestHelpers.assertFileDownloaded('singlePackageName.nupkg');
            TestHelpers.assertFileExtracted('nugetFile');
        });

        it('resolves package name to ID, then downloads and extracts', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forNameResolution()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertFileCount(TestHelpers.tempDir, 1);
            TestHelpers.assertFileDownloaded('singlePackageName.nupkg');
            TestHelpers.assertFileExtracted('nugetFile');
        });
    });

    describe('NuGet Download without Extraction', function () {
        it('downloads nuget file as nupkg without extracting', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forNuGetNoExtract()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertFileCount(TestHelpers.tempDir, 0);
            TestHelpers.assertFileCount(TestHelpers.destinationDir, 1);
            TestHelpers.assertFileInDestination('singlePackageName.nupkg');
        });
    });

    describe('NuGet Extraction Failures', function () {
        it('fails when nupkg contains a bad zip', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forBadZip()
            );

            TestHelpers.assertFailure(tr);
            TestHelpers.assertFileCount(TestHelpers.tempDir, 1);
            TestHelpers.assertFileDownloaded('badNupkgPackageName.nupkg');
            TestHelpers.assertFileNotExists(TestHelpers.destinationDir, 'nugetFile');
        });
    });
});
