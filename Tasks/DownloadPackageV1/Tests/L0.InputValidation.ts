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
            assert(tr.stderr.length === 0, 'Should not have written to stderr');
            TestHelpers.assertFileCount(TestHelpers.tempDir, 0);
        });
    });

    describe('Feed Scoping', function () {
        it('handles org-scoped feed (no project prefix)', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forNuGetDownload({
                    [TestEnvVars.feed]: 'feedId'
                })
            );

            TestHelpers.assertSuccess(tr);
        });

        it('handles project-scoped feed (project/feed format)', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forProjectScopedFeed()
            );

            TestHelpers.assertSuccess(tr);
        });
    });

    describe('Package Name Resolution', function () {
        it('resolves package name when definition is not a GUID', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forNameResolution()
            );

            // Name resolution succeeds and download completes
            TestHelpers.assertSuccess(tr);
        });

        it('does not resolve name when definition is a GUID', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forNuGetDownload()
            );

            TestHelpers.assertSuccess(tr);
        });
    });
});
