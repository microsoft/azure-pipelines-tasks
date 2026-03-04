import { TestHelpers } from './TestHelpers';
import { TestDataBuilder } from './TestConstants';

describe('DownloadPackageV1 L0 Suite - Npm Downloads', function () {
    this.timeout(30000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Npm Download with Extraction', function () {
        it('downloads npm file as tgz and extracts it', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forNpmDownload()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertFileCount(TestHelpers.tempDir, 1);
            TestHelpers.assertFileDownloaded('singlePackageName.tgz');
            TestHelpers.assertFileExtracted('npmFile');
        });
    });

    describe('Npm Download Failures', function () {
        it('fails when npm package download encounters an error', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forDownloadError({
                    '__packageType__': 'npm',
                    '__feed__': 'feedId'
                })
            );

            TestHelpers.assertFailure(tr);
        });
    });
});
