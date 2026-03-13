import { TestHelpers } from './TestHelpers';
import { TestDataBuilder } from './TestConstants';

describe('DownloadPackageV1 L0 Suite - Maven Downloads', function () {
    this.timeout(30000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Maven Multi-File Download', function () {
        it('downloads jar and pom files without extracting them', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forMavenDownload()
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertFileCount(TestHelpers.destinationDir, 2);
            TestHelpers.assertFileInDestination('packageName.jar');
            TestHelpers.assertFileInDestination('packageName.pom');
        });
    });
});
